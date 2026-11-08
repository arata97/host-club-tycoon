import { CUSTOMER, type HostingEffect, PLAYER } from "../data/balance";
import { affinityMultiplier, type CustomerType, REGULAR } from "../data/customers";
import { STAY } from "../data/economy";
import { type Grade, type Product, rollOrder } from "../data/products";
import type { Regular } from "../state";
import { moveToward } from "../util";
import type { Host } from "./host";
import type { Table } from "./table";

export type CustomerPhase = "walking" | "waiting" | "drinking" | "checkout" | "leaving" | "gone";

/** 退店の理由 */
export type LeaveReason = "angry" | "budget" | "satisfied" | "closed";

export interface CustomerInit {
  type: CustomerType;
  vip: boolean;
  /** 予算（G）。注文のたびに減り、次の注文が払えなくなったら帰る */
  budget: number;
  /** 太客なら、その記録への参照 */
  regular: Regular | null;
  /** 同伴での来店か */
  dohan?: boolean;
  /** 帰るときの会計にかかる時間（分）。0 なら会計なし */
  checkoutMin?: number;
}

/**
 * 客。入口から席へ歩き、注文を待ち、飲んで支払う。
 * 接客されていれば滞在中・予算の範囲でずっと注文が続く。誰も着いていなければ1杯で帰る。
 */
export class Customer {
  phase: CustomerPhase = "walking";
  readonly type: CustomerType;
  readonly vip: boolean;
  readonly regular: Regular | null;
  readonly dohan: boolean;
  /** 残り予算（G、全体倍率は含まない） */
  budget: number;
  readonly initialBudget: number;
  /** 待ち残り時間（分） */
  patience = CUSTOMER.patience;
  order: Product;
  drinksHad = 0;
  /** 来店してからの経過（分） */
  ageMin = 0;
  /** 着席してからの経過（分） */
  seatedMin = 0;
  private readonly baseStayMin: number;
  host: Host | null = null;
  hostedByPlayer = false;
  /** いちばん長く接客したホスト（太客化の判定用） */
  servedById: string | null = null;
  private servedTime: Record<string, number> = {};
  /** 指名ホストに接客してもらえたか */
  nominatedServed = false;
  lastPaid = 0;
  lastOrder: Product;
  leaveReason: LeaveReason | null = null;
  /** 会計が済んだら帰る理由 */
  private pendingLeave: LeaveReason = "satisfied";
  private readonly checkoutMin: number;
  /** 退店処理（太客・好感度）を World が済ませたか */
  departureHandled = false;
  readonly look = Math.floor(Math.random() * 1000);

  walkT = 0;
  facing: 1 | -1 = -1;
  private timer = 0;

  constructor(
    public x: number,
    public y: number,
    public readonly table: Table,
    firstOrder: Product,
    init: CustomerInit,
    private readonly maxGrade: Grade,
    private readonly exitX: number,
    private readonly exitY: number,
  ) {
    this.order = firstOrder;
    this.lastOrder = firstOrder;
    this.type = init.type;
    this.vip = init.vip;
    this.regular = init.regular;
    this.dohan = init.dohan ?? false;
    this.checkoutMin = init.checkoutMin ?? 0;
    this.budget = init.budget;
    this.initialBudget = init.budget;
    this.baseStayMin = STAY.baseMin + Math.random() * (STAY.baseMax - STAY.baseMin);
  }

  get angry(): boolean {
    return this.leaveReason === "angry";
  }
  get hasHost(): boolean {
    return this.host !== null || this.hostedByPlayer;
  }
  /** 指名しているホストの id（太客のみ） */
  get nominatedHostId(): string | null {
    return this.regular?.hostId ?? null;
  }

  get effect(): HostingEffect | null {
    if (this.host) return this.host.effect;
    if (this.hostedByPlayer) return PLAYER.hosting;
    return null;
  }

  get stayLimitMin(): number {
    const extra = (this.effect?.extraOrders ?? 0) + this.table.seat.extraOrders;
    return Math.min(STAY.cap, this.baseStayMin + extra * STAY.perExtraOrder);
  }

  /** 着いているホストとの相性倍率 */
  get affinity(): number {
    return this.host ? affinityMultiplier(this.type, this.host.def.race) : 1;
  }
  get nominationMultiplier(): number {
    return this.host && this.host.def.id === this.nominatedHostId ? REGULAR.nominationMultiplier : 1;
  }

  /** 注文の基本額（VIP倍率と席の倍率。予算判定用） */
  basePriceOf(p: Product): number {
    return p.price * (this.vip ? CUSTOMER.vipMultiplier : 1) * this.table.seat.priceMultiplier;
  }

  /** 現在の注文の支払額（VIP・接客・相性・指名込み。全体倍率は World が掛ける） */
  get price(): number {
    const mult = this.effect?.revenueMultiplier ?? 1;
    return Math.round(this.basePriceOf(this.order) * mult * this.affinity * this.nominationMultiplier);
  }

  attachHost(host: Host): void {
    this.host = host;
    this.hostedByPlayer = false;
    if (host.def.id === this.nominatedHostId) this.nominatedServed = true;
  }

  detachHost(): void {
    this.host = null;
  }

  setPlayerHosting(on: boolean): void {
    if (this.host) {
      this.hostedByPlayer = false;
      return;
    }
    this.hostedByPlayer = on;
  }

  serve(): boolean {
    if (this.phase !== "waiting") return false;
    this.phase = "drinking";
    this.timer = CUSTOMER.drinkTime;
    return true;
  }

  closeOut(): void {
    if (this.phase === "checkout") this.startLeaving(this.pendingLeave);
    else if (this.phase === "walking" || this.phase === "waiting" || this.phase === "drinking") this.startLeaving("closed");
  }

  /** 店長が会計を済ませる */
  completeCheckout(): boolean {
    if (this.phase !== "checkout") return false;
    this.startLeaving(this.pendingLeave);
    return true;
  }

  /**
   * 1ステップ進める（dt はゲーム内の分）。
   * - "paid": 1杯飲み終えて支払った
   * - "gaveUp": 待ちきれずに帰り始めた
   * - "left": 入口に到達して消えた
   */
  update(dt: number): "paid" | "gaveUp" | "left" | null {
    const speed = CUSTOMER.walkSpeed;
    this.ageMin += dt;
    if (this.phase === "waiting" || this.phase === "drinking") {
      this.seatedMin += dt;
      if (this.host) this.servedTime[this.host.def.id] = (this.servedTime[this.host.def.id] ?? 0) + dt;
    }
    switch (this.phase) {
      case "walking": {
        if (this.walkTo(this.table.seatX, this.table.seatY, speed, dt)) {
          this.phase = "waiting";
          this.facing = -1;
        }
        return null;
      }
      case "waiting": {
        let drain = this.effect?.patienceDrain ?? 1;
        // 指名客は誰も着いていないと倍速でいらだつ
        if (this.regular && !this.hasHost) drain *= REGULAR.unattendedDrain;
        this.patience -= dt * drain;
        if (this.patience <= 0) {
          this.startLeaving("angry");
          return "gaveUp";
        }
        return null;
      }
      case "drinking": {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.lastPaid = this.price;
          this.lastOrder = this.order;
          this.budget -= this.basePriceOf(this.order);
          this.drinksHad += 1;
          if (this.hasHost && this.seatedMin < this.stayLimitMin) {
            const next = this.rollAffordable();
            if (next) {
              this.order = next;
              this.patience = CUSTOMER.patience;
              this.phase = "waiting";
            } else {
              this.finishVisit("budget");
            }
          } else {
            this.finishVisit("satisfied");
          }
          return "paid";
        }
        return null;
      }
      case "checkout": {
        this.timer -= dt;
        if (this.timer <= 0) this.startLeaving(this.pendingLeave);
        return null;
      }
      case "leaving": {
        if (this.walkTo(this.exitX, this.exitY, speed * 1.15, dt)) {
          this.phase = "gone";
          return "left";
        }
        return null;
      }
      case "gone":
        return null;
    }
  }

  /** 予算内の次の1杯を選ぶ。数回選んでも届かなければ null（予算切れ） */
  private rollAffordable(): Product | null {
    for (let i = 0; i < 4; i++) {
      const p = rollOrder(this.maxGrade, this.vip, this.effect?.orderBonus ?? 0, this.table.grade === "exe");
      if (this.basePriceOf(p) <= this.budget) return p;
    }
    return null;
  }

  /** 飲み終えて帰る。会計が必要な店では、済むまで席を空けない（ホストは先に次の卓へ） */
  private finishVisit(reason: LeaveReason): void {
    if (this.checkoutMin <= 0) {
      this.startLeaving(reason);
      return;
    }
    this.pendingLeave = reason;
    this.phase = "checkout";
    this.timer = this.checkoutMin;
    const h = this.host;
    this.host = null;
    this.hostedByPlayer = false;
    h?.release();
  }

  private walkTo(tx: number, ty: number, speed: number, dt: number): boolean {
    const prevX = this.x;
    const arrived = moveToward(this, tx, ty, speed, dt);
    if (this.x !== prevX) this.facing = this.x > prevX ? 1 : -1;
    this.walkT = arrived ? 0 : this.walkT + dt;
    return arrived;
  }

  private startLeaving(reason: LeaveReason): void {
    this.leaveReason = reason;
    // 最も長く接客したホスト
    let best: string | null = null;
    let bestT = 0;
    for (const [id, t] of Object.entries(this.servedTime)) {
      if (t > bestT) {
        bestT = t;
        best = id;
      }
    }
    this.servedById = best;

    this.phase = "leaving";
    this.walkT = 0;
    if (this.table.customer === this) this.table.customer = null;
    this.table.claimedBy = null;
    this.table.autoBlocked = false;
    const h = this.host;
    this.host = null;
    this.hostedByPlayer = false;
    h?.release();
  }
}
