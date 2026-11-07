import type { PixelCanvas } from "../engine/canvas";
import type { Input } from "../engine/input";
import type { Loopable } from "../engine/loop";
import { drawScene, drawStick } from "../render/scene";
import { ClosingUI } from "../ui/closing";
import { GachaUI } from "../ui/gacha";
import { OfficeUI } from "../ui/office";
import type { Panel } from "../ui/panel";
import { ShopUI } from "../ui/shop";
import { ZukanUI } from "../ui/zukan";
import { SAVE } from "./data/balance";
import { DAY, formatClock, LOAN } from "./data/economy";
import { settleDay } from "./ledger";
import { Player } from "./player";
import { clearSave, GameState, loadSave, writeSave } from "./state";
import { formatG } from "./util";
import { World } from "./world";

type PanelName = "office" | "shop" | "gacha" | "zukan";

const PANEL_KEYS: Record<string, PanelName> = {
  KeyO: "office",
  KeyB: "shop",
  KeyG: "gacha",
  KeyZ: "zukan",
};

/** 開店前にしか開けないパネル */
const PREOPEN_ONLY: ReadonlySet<PanelName> = new Set<PanelName>(["office", "shop", "gacha"]);

/**
 * ゲーム全体のオーケストレーション: 1日の状態機械・ワールド・UI・セーブ。
 *   preopen（開店前・時間停止） → open（営業 20:00〜24:00） → closing（精算） → preopen（翌日）
 *   現金マイナスが続くと bankrupt → 再転生して preopen
 */
export class Game implements Loopable {
  readonly state: GameState;
  world: World;
  private readonly panels: Record<PanelName, Panel>;
  private readonly closing: ClosingUI;
  private autosaveT = 0;
  /** 24:00 を過ぎてから客が退店しきるのを待つ時間 */
  private closeGraceT = 0;
  private closingStarted = false;
  /** リセット中は beforeunload などで再保存しない */
  private suppressSave = false;
  private readonly hud = {
    money: document.getElementById("hud-money"),
    debt: document.getElementById("hud-debt"),
    carry: document.getElementById("hud-carry"),
    hosts: document.getElementById("hud-hosts"),
    sale: document.getElementById("hud-sale"),
    day: document.getElementById("hud-day"),
    clock: document.getElementById("hud-clock"),
    clockBar: document.getElementById("hud-clockbar"),
    openBtn: document.getElementById("open-btn"),
    hint: document.getElementById("hint"),
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
      office: new OfficeUI(this.state, () => this.openDay(), () => this.save()),
      shop: new ShopUI(this.state, onChange, () => this.resetGame()),
      gacha: new GachaUI(this.state, () => {
        onChange();
        this.save();
      }),
      zukan: new ZukanUI(this.state),
    };
    this.closing = new ClosingUI(
      this.state,
      () => this.nextDay(),
      () => this.reincarnate(),
    );

    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const name = PANEL_KEYS[e.code];
      if (name) this.togglePanel(name);
      if (e.code === "Escape") this.closeAllPanels();
      if (e.code === "Enter" && this.state.phase === "preopen") this.openDay();
    });
    for (const name of Object.keys(this.panels) as PanelName[]) {
      document.getElementById(`${name}-toggle`)?.addEventListener("click", () => this.togglePanel(name));
    }
    this.hud.openBtn?.addEventListener("click", () => this.openDay());

    window.addEventListener("beforeunload", () => this.save());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.save();
    });

    // 起動時の状態に応じた画面
    if (this.state.phase === "bankrupt") this.closing.showBankrupt();
    else if (this.state.phase === "preopen") this.panels.office.openPanel();
  }

  // ---------- 1日の状態機械 ----------

  openDay(): void {
    if (this.state.phase !== "preopen") return;
    this.closeAllPanels();
    this.state.phase = "open";
    this.state.clockMin = 0;
    this.closingStarted = false;
    this.closeGraceT = 0;
    this.world.startDay();
    this.save();
  }

  private settle(): void {
    const onFloor = this.world.hosts.map((h) => h.def.id);
    const report = settleDay(this.state, this.world.ledger, onFloor);
    this.state.lastReport = report;
    this.state.phase = "closing";
    if (this.state.negativeDays >= LOAN.bankruptDays && this.state.money < 0) {
      this.state.phase = "bankrupt";
      this.closing.showBankrupt();
    } else {
      this.closing.showReport(report);
    }
    this.save();
  }

  nextDay(): void {
    if (this.state.phase !== "closing") return;
    this.state.day += 1;
    this.state.phase = "preopen";
    this.state.clockMin = 0;
    this.closing.hide();
    this.panels.office.openPanel();
    this.save();
  }

  reincarnate(): void {
    if (this.state.phase !== "bankrupt") return;
    this.state.reincarnate();
    this.world = new World(this.state);
    this.closing.hide();
    this.panels.office.openPanel();
    this.save();
  }

  // ---------- パネル ----------

  togglePanel(name: PanelName): void {
    const p = this.panels[name];
    if (p.isOpen) {
      p.close();
      return;
    }
    if (PREOPEN_ONLY.has(name) && this.state.phase !== "preopen") {
      this.flashHint("ショップ・ガチャ・経営画面は開店前にだけ使えます");
      return;
    }
    if (this.state.phase === "closing" || this.state.phase === "bankrupt") return;
    this.closeAllPanels();
    p.openPanel();
  }

  closeAllPanels(): void {
    for (const p of Object.values(this.panels)) p.close();
  }

  private get anyPanelOpen(): boolean {
    return Object.values(this.panels).some((p) => p.isOpen);
  }

  private hintT = 0;
  private flashHint(text: string): void {
    if (!this.hud.hint) return;
    this.hud.hint.textContent = text;
    this.hud.hint.classList.add("flash");
    this.hintT = 3;
  }

  // ---------- ループ ----------

  update(dt: number): void {
    const s = this.state;
    const blocked = this.anyPanelOpen || s.phase === "closing" || s.phase === "bankrupt";
    const axis = blocked ? { x: 0, y: 0 } : this.input.axis();

    switch (s.phase) {
      case "preopen":
        this.world.update(dt, axis, { open: false, clockMin: 0 });
        break;
      case "open": {
        s.clockMin += dt;
        const open = s.clockMin < DAY.lengthMin;
        this.world.update(dt, axis, { open, clockMin: s.clockMin });
        if (!open) {
          if (!this.closingStarted) {
            this.closingStarted = true;
            this.world.closeFloor();
          }
          this.closeGraceT += dt;
          if (this.world.floorClear || this.closeGraceT >= DAY.closeGraceSec) this.settle();
        }
        break;
      }
      case "closing":
      case "bankrupt":
        this.world.update(dt, { x: 0, y: 0 }, { open: false, clockMin: DAY.lengthMin });
        break;
    }

    if (this.hintT > 0) {
      this.hintT -= dt;
      if (this.hintT <= 0 && this.hud.hint) {
        this.hud.hint.classList.remove("flash");
        this.hud.hint.textContent = this.defaultHint();
      }
    }

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

  resetGame(): void {
    this.suppressSave = true;
    clearSave();
    location.reload();
  }

  private defaultHint(): string {
    switch (this.state.phase) {
      case "preopen":
        return "開店前: O 経営 / B ショップ / G ガチャ / Z 図鑑 ・ Enter で開店";
      case "open":
        return "WASD / 矢印 / ドラッグで移動 ・ 酒蔵で回収、客席の前に立つと提供＆接客 ・ Z 図鑑";
      default:
        return "";
    }
  }

  private updateHud(): void {
    const s = this.state;
    const h = this.hud;
    if (h.money) {
      h.money.textContent = formatG(s.money);
      h.money.classList.toggle("negative", s.money < 0);
    }
    if (h.debt) h.debt.textContent = `借金 ${formatG(s.debt)}`;
    if (h.carry) h.carry.textContent = `🍾 ${this.world.player.carrying}/${Player.carryFor(s.upgrades.carry)}`;
    if (h.hosts) h.hosts.textContent = `ホスト ${this.world.hosts.length}/${s.tableCount}`;
    if (h.day) h.day.textContent = `Day ${s.day}${s.rebirths > 0 ? ` (${s.rebirths}周目)` : ""}`;
    if (h.clock) {
      h.clock.textContent = s.phase === "open" ? formatClock(Math.min(s.clockMin, DAY.lengthMin)) : s.phase === "preopen" ? "開店前" : "閉店";
    }
    if (h.clockBar) {
      const ratio = s.phase === "open" ? Math.min(1, s.clockMin / DAY.lengthMin) : s.phase === "preopen" ? 0 : 1;
      h.clockBar.style.width = `${(ratio * 100).toFixed(1)}%`;
      h.clockBar.classList.toggle("lastorder", s.phase === "open" && s.clockMin >= DAY.lastOrderMin);
    }
    if (h.openBtn) h.openBtn.hidden = s.phase !== "preopen";
    if (h.hint && this.hintT <= 0 && !h.hint.classList.contains("flash")) {
      const d = this.defaultHint();
      if (h.hint.textContent !== d) h.hint.textContent = d;
    }
    if (h.sale) {
      const ls = this.world.lastSale;
      h.sale.textContent = ls ? ls.text : "";
      h.sale.style.opacity = ls ? String(Math.min(1, ls.t)) : "0";
    }
  }
}
