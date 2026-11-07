import { CUSTOMER, type HostingEffect, PLAYER } from "../data/balance";
import { STAY } from "../data/economy";
import { type Grade, type Product, rollOrder } from "../data/products";
import { moveToward } from "../util";
import type { Host } from "./host";
import type { Table } from "./table";

export type CustomerPhase = "walking" | "waiting" | "drinking" | "leaving" | "gone";

/**
 * 客。入口から席へ歩き、注文を待ち、飲んで支払う。
 * 滞在時間ベース: ホスト（または主人公）が着いていると滞在が延び、その間ずっと注文が続く。
 * 誰も着いていなければ1杯で帰る。
 */
export class Customer {
  phase: CustomerPhase = "walking";
  /** 待ち残り時間（秒） */
  patience = CUSTOMER.patience;
  /** 現在の注文 */
  order: Product;
  /** 飲んだ杯数 */
  drinksHad = 0;
  /** 着席してからの経過（ゲーム内分＝秒） */
  seatedMin = 0;
  /** 基本滞在（接客なしの上限は1杯） */
  private readonly baseStayMin: number;
  /** 着いているホスト */
  host: Host | null = null;
  /** 主人公が卓に立って接客している */
  hostedByPlayer = false;
  /** 直近に支払った金額（全体倍率は含まない） */
  lastPaid = 0;
  /** 直近に支払った注文 */
  lastOrder: Product;
  /** 帰る際に怒っていたか（未提供で退店） */
  angry = false;
  /** 閉店で帰された */
  closedOut = false;
  /** 見た目の種類（描画側でパレットを選ぶ） */
  readonly look = Math.floor(Math.random() * 1000);

  walkT = 0;
  facing: 1 | -1 = -1;
  private timer = 0;

  constructor(
    public x: number,
    public y: number,
    public readonly table: Table,
    firstOrder: Product,
    public readonly vip: boolean,
    private readonly maxGrade: Grade,
    private readonly exitX: number,
    private readonly exitY: number,
  ) {
    this.order = firstOrder;
    this.lastOrder = firstOrder;
    this.baseStayMin = STAY.baseMin + Math.random() * (STAY.baseMax - STAY.baseMin);
  }

  get hasHost(): boolean {
    return this.host !== null || this.hostedByPlayer;
  }

  /** 現在効いている接客効果 */
  get effect(): HostingEffect | null {
    if (this.host) return this.host.effect;
    if (this.hostedByPlayer) return PLAYER.hosting;
    return null;
  }

  /** 接客込みの滞在上限（分） */
  get stayLimitMin(): number {
    const extra = this.effect?.extraOrders ?? 0;
    return Math.min(STAY.cap, this.baseStayMin + extra * STAY.perExtraOrder);
  }

  /** 現在の注文の支払額（VIP倍率・接客倍率込み。全体倍率は World が掛ける） */
  get price(): number {
    const mult = this.effect?.revenueMultiplier ?? 1;
    return Math.round(this.order.price * (this.vip ? CUSTOMER.vipMultiplier : 1) * mult);
  }

  attachHost(host: Host): void {
    this.host = host;
    this.hostedByPlayer = false;
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

  /** 提供を受ける。waiting のときだけ有効。 */
  serve(): boolean {
    if (this.phase !== "waiting") return false;
    this.phase = "drinking";
    this.timer = CUSTOMER.drinkTime;
    return true;
  }

  /** 閉店。席にいれば帰る（飲みかけでも支払いはしない: 1杯ごとに支払い済み） */
  closeOut(): void {
    if (this.phase === "walking" || this.phase === "waiting" || this.phase === "drinking") {
      this.closedOut = true;
      this.startLeaving();
    }
  }

  /**
   * 1ステップ進める。戻り値はこのフレームで起きたイベント。
   * - "paid": 1杯飲み終えて支払った（lastPaid を加算すること）
   * - "gaveUp": 待ちきれずに帰り始めた
   * - "left": 入口に到達して消えた
   */
  update(dt: number): "paid" | "gaveUp" | "left" | null {
    const speed = CUSTOMER.walkSpeed;
    if (this.phase === "waiting" || this.phase === "drinking") this.seatedMin += dt;
    switch (this.phase) {
      case "walking": {
        if (this.walkTo(this.table.seatX, this.table.seatY, speed, dt)) {
          this.phase = "waiting";
          this.facing = -1;
        }
        return null;
      }
      case "waiting": {
        const drain = this.effect?.patienceDrain ?? 1;
        this.patience -= dt * drain;
        if (this.patience <= 0) {
          this.angry = true;
          this.startLeaving();
          return "gaveUp";
        }
        return null;
      }
      case "drinking": {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.lastPaid = this.price;
          this.lastOrder = this.order;
          this.drinksHad += 1;
          if (this.hasHost && this.seatedMin < this.stayLimitMin) {
            // おかわり: 接客されていて滞在時間が残っている
            this.order = rollOrder(this.maxGrade, this.vip, this.effect?.orderBonus ?? 0);
            this.patience = CUSTOMER.patience;
            this.phase = "waiting";
          } else {
            this.startLeaving();
          }
          return "paid";
        }
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

  private walkTo(tx: number, ty: number, speed: number, dt: number): boolean {
    const prevX = this.x;
    const arrived = moveToward(this, tx, ty, speed, dt);
    if (this.x !== prevX) this.facing = this.x > prevX ? 1 : -1;
    this.walkT = arrived ? 0 : this.walkT + dt;
    return arrived;
  }

  private startLeaving(): void {
    this.phase = "leaving";
    this.walkT = 0;
    if (this.table.customer === this) this.table.customer = null;
    this.table.claimedBy = null;
    const h = this.host;
    this.host = null;
    this.hostedByPlayer = false;
    h?.release();
  }
}
