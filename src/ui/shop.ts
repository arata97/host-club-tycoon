import { UPGRADES, type UpgradeKey } from "../game/data/balance";
import { maxGradeForCellar } from "../game/data/products";
import { staffCarryFor, staffSpeedFor } from "../game/entities/staff";
import { Player } from "../game/player";
import type { GameState } from "../game/state";
import { formatG } from "../game/util";
import { BasePanel, buildPanelHead } from "./panel";

interface Row {
  key: UpgradeKey;
  label: string;
  /** 現在の効果の説明 */
  effect: (s: GameState) => string;
}

interface Section {
  title: string;
  rows: Row[];
  /** 行の代わりに表示する説明文 */
  note?: (s: GameState) => string;
}

const SECTIONS: Section[] = [
  {
    title: "店舗",
    rows: [
      {
        key: "table",
        label: "テーブル増設",
        effect: (s) => `${s.tableCount} 卓 → ${s.tableCount + 1} 卓（ホストの出勤枠も+1）`,
      },
      {
        key: "cellar",
        label: "酒蔵アップグレード",
        effect: (s) => {
          const next = s.cellarLevel + 1;
          const g = maxGradeForCellar(s.cellarLevel);
          const ng = maxGradeForCellar(next);
          return `Lv${s.cellarLevel} → Lv${next}（在庫・補充速度UP${ng > g ? `、グレード${ng}の酒を解放!` : ""}）`;
        },
      },
    ],
  },
  {
    title: "店長（主人公）",
    rows: [
      {
        key: "speed",
        label: "移動速度",
        effect: (s) => `${Math.round(Player.speedFor(s.upgrades.speed))} → ${Math.round(Player.speedFor(s.upgrades.speed + 1))}`,
      },
      {
        key: "carry",
        label: "運搬数",
        effect: (s) => `${Player.carryFor(s.upgrades.carry)} 本 → ${Player.carryFor(s.upgrades.carry + 1)} 本`,
      },
    ],
  },
  {
    title: "内勤（黒服）— 酒を運ぶ",
    rows: [
      {
        key: "staff",
        label: "内勤を雇う",
        effect: (s) => `${s.staffCount} 人 → ${s.staffCount + 1} 人（酒蔵から客席へ自動で運搬）`,
      },
      {
        key: "staffLv",
        label: "内勤教育",
        effect: (s) => {
          const lv = s.staffLevel;
          return `速度 ${Math.round(staffSpeedFor(lv))}→${Math.round(staffSpeedFor(lv + 1))}、運搬 ${staffCarryFor(lv)}→${staffCarryFor(lv + 1)} 本`;
        },
      },
    ],
  },
  {
    title: "ホスト — 卓に着いて接客",
    rows: [],
    note: (s) =>
      `ホストはガチャ（G キー）で獲得します。出勤できるのはテーブル数（${s.tableCount}人）まで、レア度の高い順。所持 ${s.ownedDefs().length} 人。`,
  },
];

/** ショップパネル（HTML オーバーレイ） */
export class ShopUI extends BasePanel {
  private readonly rowEls = new Map<UpgradeKey, { cost: HTMLElement; effect: HTMLElement; level: HTMLElement; btn: HTMLButtonElement }>();
  private readonly noteEls: Array<{ el: HTMLElement; text: (s: GameState) => string }> = [];
  private readonly totalEl: HTMLElement;
  private lastSig = "";

  constructor(
    private readonly state: GameState,
    private readonly onPurchase: () => void,
    private readonly onReset: () => void,
  ) {
    super("shop");
    const root = this.root;
    root.innerHTML = "";
    root.appendChild(buildPanelHead("ショップ", "B キーで開閉 / Esc で閉じる", () => this.close()));

    const list = document.createElement("div");
    list.className = "shop-list";
    for (const section of SECTIONS) {
      const h3 = document.createElement("h3");
      h3.className = "panel-section";
      h3.textContent = section.title;
      list.appendChild(h3);
      for (const row of section.rows) list.appendChild(this.buildRow(row));
      if (section.note) {
        const note = document.createElement("div");
        note.className = "shop-note";
        list.appendChild(note);
        this.noteEls.push({ el: note, text: section.note });
      }
    }
    root.appendChild(list);

    const foot = document.createElement("div");
    foot.className = "panel-foot";
    this.totalEl = document.createElement("span");
    foot.appendChild(this.totalEl);
    const reset = document.createElement("button");
    reset.className = "shop-reset";
    reset.type = "button";
    reset.textContent = "最初からやり直す";
    reset.addEventListener("click", () => {
      if (confirm("セーブデータを消して最初からやり直しますか？")) this.onReset();
    });
    foot.appendChild(reset);
    root.appendChild(foot);

    this.refresh(true);
  }

  private buildRow(row: Row): HTMLElement {
    const el = document.createElement("div");
    el.className = "shop-row";
    const info = document.createElement("div");
    info.className = "shop-info";
    const title = document.createElement("div");
    title.className = "shop-title";
    const level = document.createElement("span");
    level.className = "shop-level";
    title.textContent = row.label + " ";
    title.appendChild(level);
    const effect = document.createElement("div");
    effect.className = "shop-effect";
    info.append(title, effect);
    const btn = document.createElement("button");
    btn.className = "btn-gold";
    btn.type = "button";
    const cost = document.createElement("span");
    btn.appendChild(cost);
    btn.addEventListener("click", () => {
      if (this.state.buy(row.key)) {
        this.onPurchase();
        this.refresh(true);
      }
    });
    el.append(info, btn);
    this.rowEls.set(row.key, { cost, effect, level, btn });
    return el;
  }

  refresh(force = false): void {
    const s = this.state;
    const sig = `${Math.floor(s.money)}|${Object.values(s.upgrades).join(",")}|${s.ownedDefs().length}`;
    if (!force && sig === this.lastSig) return;
    this.lastSig = sig;

    for (const section of SECTIONS) {
      for (const row of section.rows) {
        const els = this.rowEls.get(row.key);
        if (!els) continue;
        const maxed = s.isMaxed(row.key);
        els.level.textContent = `Lv ${s.upgrades[row.key]}/${UPGRADES[row.key].max}`;
        els.effect.textContent = maxed ? "最大まで強化済み" : row.effect(s);
        els.cost.textContent = maxed ? "MAX" : formatG(s.costOf(row.key));
        els.btn.disabled = !s.canBuy(row.key);
      }
    }
    for (const n of this.noteEls) n.el.textContent = n.text(s);
    this.totalEl.textContent = `所持金 ${formatG(s.money)} ／ 累計売上 ${formatG(s.totalRevenue)}`;
  }
}
