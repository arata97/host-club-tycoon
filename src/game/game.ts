import type { PixelCanvas } from "../engine/canvas";
import type { Input } from "../engine/input";
import type { Loopable } from "../engine/loop";
import { drawScene, drawStick } from "../render/scene";
import { GachaUI } from "../ui/gacha";
import type { Panel } from "../ui/panel";
import { ShopUI } from "../ui/shop";
import { ZukanUI } from "../ui/zukan";
import { SAVE } from "./data/balance";
import { Player } from "./player";
import { clearSave, GameState, loadSave, writeSave } from "./state";
import { formatG } from "./util";
import { World } from "./world";

type PanelName = "shop" | "gacha" | "zukan";

const PANEL_KEYS: Record<string, PanelName> = {
  KeyB: "shop",
  KeyG: "gacha",
  KeyZ: "zukan",
};

/**
 * ゲーム全体のオーケストレーション: 状態・ワールド・UI・セーブ。
 */
export class Game implements Loopable {
  readonly state: GameState;
  readonly world: World;
  private readonly panels: Record<PanelName, Panel>;
  private autosaveT = 0;
  /** リセット中は beforeunload などで再保存しない */
  private suppressSave = false;
  private readonly hud = {
    money: document.getElementById("hud-money"),
    carry: document.getElementById("hud-carry"),
    sale: document.getElementById("hud-sale"),
    hosts: document.getElementById("hud-hosts"),
  };

  constructor(
    private readonly canvas: PixelCanvas,
    private readonly input: Input,
  ) {
    const saved = loadSave();
    this.state = saved ? GameState.fromSave(saved) : new GameState();
    this.world = new World(this.state);

    const onChange = () => this.world.syncWithState();
    this.panels = {
      shop: new ShopUI(this.state, onChange, () => this.resetGame()),
      gacha: new GachaUI(this.state, () => {
        onChange();
        this.save();
      }),
      zukan: new ZukanUI(this.state),
    };

    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const name = PANEL_KEYS[e.code];
      if (name) this.togglePanel(name);
      if (e.code === "Escape") this.closeAllPanels();
    });
    for (const name of Object.keys(this.panels) as PanelName[]) {
      document.getElementById(`${name}-toggle`)?.addEventListener("click", () => this.togglePanel(name));
    }

    window.addEventListener("beforeunload", () => this.save());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.save();
    });
  }

  /** パネルは同時に1つだけ開く */
  togglePanel(name: PanelName): void {
    const p = this.panels[name];
    if (p.isOpen) {
      p.close();
      return;
    }
    this.closeAllPanels();
    p.openPanel();
  }

  closeAllPanels(): void {
    for (const p of Object.values(this.panels)) p.close();
  }

  private get anyPanelOpen(): boolean {
    return Object.values(this.panels).some((p) => p.isOpen);
  }

  update(dt: number): void {
    // パネルを開いている間は移動入力を止める（シミュレーションは進む）
    const axis = this.anyPanelOpen ? { x: 0, y: 0 } : this.input.axis();
    this.world.update(dt, axis);

    this.autosaveT += dt;
    if (this.autosaveT >= SAVE.autosaveInterval) {
      this.autosaveT = 0;
      this.save();
    }
  }

  render(_alpha: number): void {
    const ctx = this.canvas.ctx;
    drawScene(ctx, this.world, this.state);
    drawStick(ctx, this.input.stick(), this.input.stickRadius);
    this.updateHud();
    for (const p of Object.values(this.panels)) if (p.isOpen) p.refresh();
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
    const { money, carry, sale, hosts } = this.hud;
    if (money) money.textContent = formatG(this.state.money);
    if (carry) carry.textContent = `🍾 ${this.world.player.carrying}/${Player.carryFor(this.state.upgrades.carry)}`;
    if (hosts) hosts.textContent = `ホスト ${this.world.hosts.length}/${this.state.tableCount}`;
    if (sale) {
      const s = this.world.lastSale;
      sale.textContent = s ? s.text : "";
      sale.style.opacity = s ? String(Math.min(1, s.t)) : "0";
    }
  }
}
