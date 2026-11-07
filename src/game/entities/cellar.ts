import { CELLAR } from "../data/balance";

/** 酒蔵（バーカウンター）。時間でボトルが補充され、近づいた者が回収する。 */
export class Cellar {
  stock = 0;
  private regenT = 0;
  readonly w = 56;
  readonly h = 22;

  constructor(
    public x: number,
    public y: number,
  ) {}

  /** 回収や提供の判定に使う足元位置（カウンターの手前） */
  get interactX(): number {
    return this.x;
  }
  get interactY(): number {
    return this.y + this.h / 2 + 10;
  }

  capacity(level: number): number {
    return CELLAR.capacityBase + CELLAR.capacityPerLevel * (level - 1);
  }
  regenTime(level: number): number {
    return CELLAR.regenBase / (1 + CELLAR.regenPerLevel * (level - 1));
  }

  update(dt: number, level: number): void {
    const cap = this.capacity(level);
    if (this.stock >= cap) {
      this.regenT = 0;
      return;
    }
    this.regenT += dt;
    const t = this.regenTime(level);
    while (this.regenT >= t && this.stock < cap) {
      this.regenT -= t;
      this.stock += 1;
    }
  }

  take(): boolean {
    if (this.stock <= 0) return false;
    this.stock -= 1;
    return true;
  }

  draw(ctx: CanvasRenderingContext2D, level: number): void {
    const x = Math.round(this.x - this.w / 2);
    const y = Math.round(this.y - this.h / 2);
    // 背面の棚
    ctx.fillStyle = "#3b2a1e";
    ctx.fillRect(x, y - 16, this.w, 16);
    ctx.fillStyle = "#5a3f2c";
    ctx.fillRect(x, y - 16, this.w, 2);
    ctx.fillRect(x, y - 8, this.w, 2);
    // 棚のボトル（在庫数ぶん）
    const cap = this.capacity(level);
    for (let i = 0; i < cap; i++) {
      const bx = x + 4 + (i % 12) * 4;
      const by = y - 14 + Math.floor(i / 12) * 8;
      if (i < this.stock) {
        ctx.fillStyle = "#2b6f8f";
        ctx.fillRect(bx, by, 3, 5);
        ctx.fillStyle = "#8fd3ff";
        ctx.fillRect(bx + 1, by - 1, 1, 1);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(bx, by, 3, 5);
      }
    }
    // カウンター
    ctx.fillStyle = "#6b4a2f";
    ctx.fillRect(x, y, this.w, this.h);
    ctx.fillStyle = "#8a6240";
    ctx.fillRect(x, y, this.w, 4);
    ctx.fillStyle = "#4a3220";
    ctx.fillRect(x, y + this.h - 3, this.w, 3);
    // ラベル
    ctx.font = "7px monospace";
    ctx.fillStyle = "#f4e7c3";
    ctx.textAlign = "center";
    ctx.fillText(`酒蔵 Lv${level}`, this.x, y + 14);
    ctx.textAlign = "left";
  }
}
