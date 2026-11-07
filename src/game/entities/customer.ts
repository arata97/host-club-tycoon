import { CUSTOMER, type HostingEffect, PLAYER } from "../data/balance";
import { type Grade, type Product, rollOrder } from "../data/products";
import { moveToward } from "../util";
import type { Host } from "./host";
import type { Table } from "./table";

export type CustomerPhase = "walking" | "waiting" | "drinking" | "leaving" | "gone";

/**
 * 客。入口から席へ歩き、注文を待ち、飲んで支払う。
 * ホスト（または主人公）が着いていると追加注文し、我慢ゲージの減りが遅くなる。
 */
export class Customer {
  phase: CustomerPhase = "walking";
  /** 待ち残り時間（秒） */
  patience = CUSTOMER.patience;
  /** 現在の注文 */
  order: Product;
  /** 残り注文杯数（現在の注文を含む） */
  drinksLeft = 1;
  /** 飲んだ杯数 */
  drinksHad = 0;
  /** 着いているホスト */
  host: Host | null = null;
  /** 主人公が卓に立って接客している */
  hostedByPlayer = false;
  /** 直近に支払った金額（"paid" イベント時に World が読む。全体倍率は含まない） */
  lastPaid = 0;
  /** 直近に支払った注文（おかわりで order が次の注文に変わるため別に保持） */
  lastOrder: Product;
  /** 帰る際に怒っていたか（未提供で退店） */
  angry = false;
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

  /** 現在の注文の支払額（VIP倍率・接客倍率込み。全体倍率は World が掛ける） */
  get price(): number {
    const mult = this.effect?.revenueMultiplier ?? 1;
    return Math.round(this.order.price * (this.vip ? CUSTOMER.vipMultiplier : 1) * mult);
  }

  /** 1回の来店で飲む総杯数が total になるよう、残り杯数（現在の1杯を含む）を引き上げる */
  private raiseTotalDrinks(total: number): void {
    this.drinksLeft = Math.max(this.drinksLeft, total - this.drinksHad);
  }

  /** ホストが着いた。追加注文ぶんを上乗せ */
  attachHost(host: Host): void {
    this.host = host;
    this.hostedByPlayer = false;
    this.raiseTotalDrinks(1 + host.effect.extraOrders);
  }

  /** ホストが離れた（出勤メンバーの入れ替えなど） */
  detachHost(): void {
    this.host = null;
  }

  /** 主人公の接客の開始／終了 */
  setPlayerHosting(on: boolean): void {
    if (this.host) {
      this.hostedByPlayer = false;
      return;
    }
    if (on && !this.hostedByPlayer) this.raiseTotalDrinks(1 + PLAYER.hosting.extraOrders);
    this.hostedByPlayer = on;
  }

  /** 提供を受ける。waiting のときだけ有効。 */
  serve(): boolean {
    if (this.phase !== "waiting") return false;
    this.phase = "drinking";
    this.timer = CUSTOMER.drinkTime;
    return true;
  }

  /**
   * 1ステップ進める。戻り値はこのフレームで起きたイベント。
   * - "paid": 1杯飲み終えて支払った（lastPaid を加算すること）
   * - "gaveUp": 待ちきれずに帰り始めた
   * - "left": 入口に到達して消えた
   */
  update(dt: number): "paid" | "gaveUp" | "left" | null {
    const speed = CUSTOMER.walkSpeed;
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
          this.drinksLeft -= 1;
          if (this.drinksLeft > 0 && this.hasHost) {
            // おかわり
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
