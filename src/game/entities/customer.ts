import { CUSTOMER } from "../data/balance";
import type { Product } from "../data/products";
import { drawPerson, GRADE_COLOR, moveToward, type PersonPalette } from "../util";
import type { Table } from "./table";

export type CustomerPhase = "walking" | "waiting" | "drinking" | "leaving" | "gone";

const PALETTES: PersonPalette[] = [
  { suit: "#c94f7c", shirt: "#ffe3ec", skin: "#f1c9a5", hair: "#3b2a1e" },
  { suit: "#3f7fbf", shirt: "#e8f3ff", skin: "#e8b48c", hair: "#1c1826" },
  { suit: "#4f9f6f", shirt: "#eafff0", skin: "#f7d6b8", hair: "#8a4b2a" },
  { suit: "#9f6fd0", shirt: "#f3eaff", skin: "#f1c9a5", hair: "#e0c060" },
  { suit: "#d08a3f", shirt: "#fff4e3", skin: "#c98f63", hair: "#2a2a2a" },
];
const VIP_PALETTE: PersonPalette = { suit: "#f6c453", shirt: "#fff8dc", skin: "#f1c9a5", hair: "#ffffff" };

function pickPalette(): PersonPalette {
  const p = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  return p ?? VIP_PALETTE;
}

/** 客。入口から席へ歩き、注文を待ち、飲んで支払い、帰る。 */
export class Customer {
  phase: CustomerPhase = "walking";
  /** 待ち残り時間（秒） */
  patience = CUSTOMER.patience;
  private timer = 0;
  private walkT = 0;
  private facing: 1 | -1 = 1;
  private readonly palette: PersonPalette;
  /** 帰る際に怒っていたか（未提供で退店） */
  angry = false;

  constructor(
    public x: number,
    public y: number,
    public readonly table: Table,
    public readonly order: Product,
    public readonly vip: boolean,
    private readonly exitX: number,
    private readonly exitY: number,
  ) {
    this.palette = vip ? VIP_PALETTE : pickPalette();
  }

  get price(): number {
    return this.order.price * (this.vip ? CUSTOMER.vipMultiplier : 1);
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
   * - "paid": 飲み終えて支払った（price を加算すること）
   * - "gaveUp": 待ちきれずに帰り始めた
   * - "left": 入口に到達して消えた
   */
  update(dt: number): "paid" | "gaveUp" | "left" | null {
    const speed = CUSTOMER.walkSpeed;
    switch (this.phase) {
      case "walking": {
        const prevX = this.x;
        const arrived = moveToward(this, this.table.seatX, this.table.seatY, speed, dt);
        this.walkT += dt;
        if (this.x !== prevX) this.facing = this.x > prevX ? 1 : -1;
        if (arrived) {
          this.phase = "waiting";
          this.walkT = 0;
          this.facing = 1;
        }
        return null;
      }
      case "waiting": {
        this.patience -= dt;
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
          this.startLeaving();
          return "paid";
        }
        return null;
      }
      case "leaving": {
        const prevX = this.x;
        const arrived = moveToward(this, this.exitX, this.exitY, speed * 1.15, dt);
        this.walkT += dt;
        if (this.x !== prevX) this.facing = this.x > prevX ? 1 : -1;
        if (arrived) {
          this.phase = "gone";
          return "left";
        }
        return null;
      }
      case "gone":
        return null;
    }
  }

  private startLeaving(): void {
    this.phase = "leaving";
    this.walkT = 0;
    if (this.table.customer === this) this.table.customer = null;
    this.table.claimedBy = null;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawPerson(ctx, this.x, this.y, this.palette, this.phase === "walking" || this.phase === "leaving" ? this.walkT : 0, this.facing);
    const px = Math.round(this.x);
    const py = Math.round(this.y);

    if (this.vip) {
      // 王冠
      ctx.fillStyle = "#f6c453";
      ctx.fillRect(px - 3, py - 21, 6, 2);
      ctx.fillRect(px - 3, py - 23, 1, 2);
      ctx.fillRect(px, py - 23, 1, 2);
      ctx.fillRect(px + 2, py - 23, 1, 2);
    }

    if (this.phase === "waiting") {
      // 吹き出し＋注文ボトル＋待ち時間バー
      const bx = px + 8;
      const by = py - 30;
      ctx.fillStyle = "#fffaf0";
      ctx.fillRect(bx, by, 14, 12);
      ctx.fillRect(bx + 2, by + 12, 3, 2);
      ctx.fillStyle = "#2b6f8f";
      ctx.fillRect(bx + 5, by + 4, 4, 6);
      ctx.fillStyle = GRADE_COLOR[this.order.grade];
      ctx.fillRect(bx + 6, by + 2, 2, 3);
      const ratio = Math.max(0, this.patience / CUSTOMER.patience);
      ctx.fillStyle = "#333";
      ctx.fillRect(bx, by + 15, 14, 2);
      ctx.fillStyle = ratio > 0.4 ? "#7bd88f" : ratio > 0.2 ? "#f6c453" : "#ff6b6b";
      ctx.fillRect(bx, by + 15, Math.round(14 * ratio), 2);
    } else if (this.phase === "drinking") {
      // 手元のグラス
      ctx.fillStyle = GRADE_COLOR[this.order.grade];
      ctx.fillRect(px + 5, py - 10, 2, 3);
      ctx.fillStyle = "#fffaf0";
      ctx.fillRect(px + 5, py - 7, 2, 1);
    } else if (this.phase === "leaving" && this.angry) {
      ctx.font = "bold 8px monospace";
      ctx.fillStyle = "#ff6b6b";
      ctx.fillText("!", px + 6, py - 20);
    }
  }
}
