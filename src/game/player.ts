import type { Vec2 } from "../engine/input";

/** 主人公。Phase 0 では移動のみ。 */
export class Player {
  x: number;
  y: number;
  /** 論理px/秒 */
  speed = 90;
  readonly w = 12;
  readonly h = 16;
  facing: 1 | -1 = 1;
  private walkT = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  update(dt: number, axis: Vec2, bounds: { w: number; h: number }): void {
    this.x += axis.x * this.speed * dt;
    this.y += axis.y * this.speed * dt;
    if (axis.x !== 0) this.facing = axis.x > 0 ? 1 : -1;
    const moving = axis.x !== 0 || axis.y !== 0;
    this.walkT = moving ? this.walkT + dt : 0;

    this.x = Math.max(this.w / 2, Math.min(bounds.w - this.w / 2, this.x));
    this.y = Math.max(this.h, Math.min(bounds.h, this.y));
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const px = Math.round(this.x);
    const py = Math.round(this.y);
    const bob = Math.round(Math.sin(this.walkT * 14) * 1); // 歩行の上下

    // 影
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(px - 6, py - 2, 12, 3);

    // 体（黒スーツ）
    ctx.fillStyle = "#1c1826";
    ctx.fillRect(px - 5, py - 10 + bob, 10, 9);
    // シャツ
    ctx.fillStyle = "#f4f0ff";
    ctx.fillRect(px - 1, py - 10 + bob, 2, 6);
    // 頭
    ctx.fillStyle = "#f1c9a5";
    ctx.fillRect(px - 4, py - 16 + bob, 8, 7);
    // 髪（ホストらしい明るめ）
    ctx.fillStyle = "#d9a441";
    ctx.fillRect(px - 5, py - 18 + bob, 10, 4);
    ctx.fillRect(px - 5, py - 14 + bob, 2, 3);
    // 目（向きに応じて）
    ctx.fillStyle = "#1c1826";
    ctx.fillRect(px + (this.facing > 0 ? 1 : -2), py - 13 + bob, 1, 1);
    // 脚
    ctx.fillStyle = "#1c1826";
    const step = this.walkT > 0 ? Math.round(Math.sin(this.walkT * 14)) : 0;
    ctx.fillRect(px - 4, py - 1, 3, 2 + step);
    ctx.fillRect(px + 1, py - 1, 3, 2 - step);
  }
}
