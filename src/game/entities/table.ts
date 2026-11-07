import type { Customer } from "./customer";
import type { Host } from "./host";

/** 客席。客が1人座る。ホストが提供に向かうときは claim して重複を防ぐ。 */
export class Table {
  customer: Customer | null = null;
  /** 次に来店する客のために予約済み */
  reserved = false;
  claimedBy: Host | null = null;
  readonly w = 30;
  readonly h = 16;

  constructor(
    public x: number,
    public y: number,
  ) {}

  /** 客が立つ位置（テーブルの奥側） */
  get seatX(): number {
    return this.x;
  }
  get seatY(): number {
    return this.y - 6;
  }
  /** 提供する側が立つ位置（手前側） */
  get serveX(): number {
    return this.x;
  }
  get serveY(): number {
    return this.y + 22;
  }

  get isFree(): boolean {
    return this.customer === null && !this.reserved;
  }
  get needsService(): boolean {
    return this.customer !== null && this.customer.phase === "waiting";
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const x = Math.round(this.x - this.w / 2);
    const y = Math.round(this.y - this.h / 2);
    // ソファ（奥）
    ctx.fillStyle = "#7a1f3a";
    ctx.fillRect(x - 2, y - 10, this.w + 4, 8);
    ctx.fillStyle = "#a02a4e";
    ctx.fillRect(x - 2, y - 10, this.w + 4, 2);
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
