import { LOGICAL_H, LOGICAL_W, type PixelCanvas } from "../engine/canvas";
import type { Input } from "../engine/input";
import type { Loopable } from "../engine/loop";
import { Player } from "./player";

/**
 * ゲーム全体の状態と描画。Phase 0: 店の床と主人公だけ。
 */
export class Game implements Loopable {
  readonly player = new Player(LOGICAL_W / 2, LOGICAL_H / 2);
  money = 0;
  private readonly hudMoney: HTMLElement | null;

  constructor(
    private canvas: PixelCanvas,
    private input: Input,
  ) {
    this.hudMoney = document.getElementById("hud-money");
  }

  update(dt: number): void {
    this.player.update(dt, this.input.axis(), { w: LOGICAL_W, h: LOGICAL_H });
  }

  render(_alpha: number): void {
    const ctx = this.canvas.ctx;
    this.drawFloor(ctx);
    this.player.draw(ctx);
    this.drawStick(ctx);
    if (this.hudMoney) this.hudMoney.textContent = `${this.money.toLocaleString("ja-JP")} G`;
  }

  private drawFloor(ctx: CanvasRenderingContext2D): void {
    // 壁
    ctx.fillStyle = "#2a1f3d";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    // 床（市松模様の絨毯）
    const tile = 20;
    for (let y = 40; y < LOGICAL_H; y += tile) {
      for (let x = 0; x < LOGICAL_W; x += tile) {
        const odd = ((x / tile + y / tile) & 1) === 1;
        ctx.fillStyle = odd ? "#5a1f33" : "#4d1a2b";
        ctx.fillRect(x, y, tile, tile);
      }
    }
    // 壁の腰板
    ctx.fillStyle = "#3d2b55";
    ctx.fillRect(0, 34, LOGICAL_W, 6);
    // 壁のライト
    ctx.fillStyle = "#f6c453";
    for (let x = 30; x < LOGICAL_W; x += 60) {
      ctx.fillRect(x, 14, 4, 6);
      ctx.fillStyle = "rgba(246,196,83,0.15)";
      ctx.fillRect(x - 8, 20, 20, 14);
      ctx.fillStyle = "#f6c453";
    }
  }

  private drawStick(ctx: CanvasRenderingContext2D): void {
    const s = this.input.stick();
    if (!s) return;
    const r = this.input.stickRadius;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(s.origin.x, s.origin.y, r, 0, Math.PI * 2);
    ctx.stroke();
    const dx = s.current.x - s.origin.x;
    const dy = s.current.y - s.origin.y;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, len / r) * r;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.arc(s.origin.x + (dx / len) * k, s.origin.y + (dy / len) * k, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}
