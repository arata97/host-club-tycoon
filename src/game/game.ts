import type { PixelCanvas } from "../engine/canvas";
import type { Input } from "../engine/input";
import type { Loopable } from "../engine/loop";
import { ShopUI } from "../ui/shop";
import { SAVE } from "./data/balance";
import { Player } from "./player";
import { clearSave, GameState, loadSave, writeSave } from "./state";
import { formatG } from "./util";
import { World } from "./world";

/**
 * ゲーム全体のオーケストレーション: 状態・ワールド・UI・セーブ。
 */
export class Game implements Loopable {
  readonly state: GameState;
  readonly world: World;
  private readonly shop: ShopUI;
  private autosaveT = 0;
  /** リセット中は beforeunload などで再保存しない */
  private suppressSave = false;
  private readonly hud = {
    money: document.getElementById("hud-money"),
    carry: document.getElementById("hud-carry"),
    sale: document.getElementById("hud-sale"),
  };

  constructor(
    private readonly canvas: PixelCanvas,
    private readonly input: Input,
  ) {
    const saved = loadSave();
    this.state = saved ? GameState.fromSave(saved) : new GameState();
    this.world = new World(this.state);
    this.shop = new ShopUI(
      this.state,
      () => this.world.syncWithState(),
      () => this.resetGame(),
    );

    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyB") this.shop.toggle();
      if (e.code === "Escape") this.shop.close();
    });
    window.addEventListener("beforeunload", () => this.save());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.save();
    });
  }

  update(dt: number): void {
    // ショップを開いている間は入力を止める（シミュレーションは進む）
    const axis = this.shop.isOpen ? { x: 0, y: 0 } : this.input.axis();
    this.world.update(dt, axis);

    this.autosaveT += dt;
    if (this.autosaveT >= SAVE.autosaveInterval) {
      this.autosaveT = 0;
      this.save();
    }
  }

  render(_alpha: number): void {
    const ctx = this.canvas.ctx;
    this.world.render(ctx);
    this.drawStick(ctx);
    this.updateHud();
    this.shop.refresh();
  }

  save(): void {
    if (this.suppressSave) return;
    writeSave(this.state.toSave());
  }

  /** セーブを消して最初から。リロードで全状態を作り直す。 */
  resetGame(): void {
    this.suppressSave = true;
    clearSave();
    location.reload();
  }

  private updateHud(): void {
    const { money, carry, sale } = this.hud;
    if (money) money.textContent = formatG(this.state.money);
    if (carry) carry.textContent = `🍾 ${this.world.player.carrying}/${Player.carryFor(this.state.upgrades.carry)}`;
    if (sale) {
      const s = this.world.lastSale;
      sale.textContent = s ? s.text : "";
      sale.style.opacity = s ? String(Math.min(1, s.t)) : "0";
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
