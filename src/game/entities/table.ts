import type { Customer } from "./customer";
import type { Host } from "./host";
import type { Staff } from "./staff";

/**
 * 客席。客が1人座り、ホストが1人着く。
 * 内勤が提供に向かうときは claimedBy で重複を防ぐ。
 */
export class Table {
  customer: Customer | null = null;
  /** 着いているホスト */
  host: Host | null = null;
  /** 提供に向かっている内勤 */
  claimedBy: Staff | null = null;
  readonly w = 30;
  readonly h = 16;

  constructor(
    public x: number,
    public y: number,
  ) {}

  /** 客が座る位置（ソファ右側） */
  get seatX(): number {
    return this.x + 7;
  }
  get seatY(): number {
    return this.y - 6;
  }
  /** ホストが着く位置（ソファ左側） */
  get hostX(): number {
    return this.x - 8;
  }
  get hostY(): number {
    return this.y - 6;
  }
  /** 提供・接客する側が立つ位置（手前側） */
  get serveX(): number {
    return this.x;
  }
  get serveY(): number {
    return this.y + 22;
  }

  get isFree(): boolean {
    return this.customer === null;
  }
  get needsService(): boolean {
    return this.customer !== null && this.customer.phase === "waiting";
  }
  /** ホストが着く価値がある（客がいて、まだホストがいない） */
  get wantsHost(): boolean {
    return this.customer !== null && this.customer.phase !== "leaving" && this.customer.phase !== "gone" && this.host === null;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const x = Math.round(this.x - this.w / 2);
    const y = Math.round(this.y - this.h / 2);
    // ソファ（奥）
    ctx.fillStyle = "#7a1f3a";
    ctx.fillRect(x - 4, y - 10, this.w + 8, 8);
    ctx.fillStyle = "#a02a4e";
    ctx.fillRect(x - 4, y - 10, this.w + 8, 2);
    // テーブル
    ctx.fillStyle = "#1e1a2a";
    ctx.fillRect(x, y + 2, this.w, this.h);
    ctx.fillStyle = "#3a3350";
    ctx.fillRect(x, y, this.w, this.h);
    ctx.fillStyle = "#5c5378";
    ctx.fillRect(x + 1, y + 1, this.w - 2, 2);
    // キャンドル
    ctx.fillStyle = "#f6c453";
    ctx.fillRect(Math.round(this.x), y + 5, 2, 3);
    ctx.fillStyle = "#fff2b0";
    ctx.fillRect(Math.round(this.x), y + 4, 2, 1);
  }
}
