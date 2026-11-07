import { GACHA, RARITIES, type Rarity } from "../game/data/balance";
import { REGULAR } from "../game/data/customers";
import { HOST_ROSTER, type HostDef } from "../game/data/hosts";
import { RACES } from "../game/data/races";
import { hostEffect } from "../game/entities/host";
import type { GameState } from "../game/state";
import { BasePanel, buildPanelHead } from "./panel";
import { createPortrait } from "./portrait";

/** 図鑑パネル。所持ホストの詳細、未所持はシルエット。UR は入手するまで存在を隠す */
export class ZukanUI extends BasePanel {
  private readonly summaryEl: HTMLElement;
  private readonly gridEl: HTMLElement;
  private lastSig = "";

  constructor(private readonly state: GameState) {
    super("zukan");
    const root = this.root;
    root.innerHTML = "";
    root.appendChild(buildPanelHead("ホスト図鑑", "Z キーで開閉 / Esc で閉じる", () => this.close()));
    this.summaryEl = document.createElement("div");
    this.summaryEl.className = "zukan-summary";
    this.gridEl = document.createElement("div");
    this.gridEl.className = "zukan-body";
    root.append(this.summaryEl, this.gridEl);
    this.refresh(true);
  }

  private urRevealed(): boolean {
    return HOST_ROSTER.some((d) => d.rarity === "UR" && this.state.owns(d.id));
  }

  refresh(force = false): void {
    const s = this.state;
    const onFloor = new Set(s.onFloorDefs().map((d) => d.id));
    const hostSig = Object.entries(s.hosts)
      .map(([id, h]) => `${id}:${h.lb}:${Math.round(h.stamina / 5)}`)
      .join(",");
    const regSig = s.regulars.map((r) => `${r.id}:${Math.round(r.affinity)}`).join(",");
    const sig = `${hostSig}|${regSig}|${s.tableCount}|${s.rosterMode}|${s.manualRoster.join(",")}`;
    if (!force && sig === this.lastSig) return;
    this.lastSig = sig;

    const showUR = this.urRevealed();
    const visible = HOST_ROSTER.filter((d) => d.rarity !== "UR" || showUR);
    const ownedCount = visible.filter((d) => s.owns(d.id)).length;

    // ---- サマリー（所持数・コンプボーナス） ----
    this.summaryEl.innerHTML = "";
    const count = document.createElement("div");
    count.className = "zukan-count";
    count.textContent = `所持 ${ownedCount} / ${visible.length}　出勤 ${onFloor.size} / ${s.tableCount} 卓`;
    this.summaryEl.appendChild(count);

    const bonuses = document.createElement("div");
    bonuses.className = "zukan-bonuses";
    for (const r of RARITIES) {
      if (r === "UR" && !showUR) continue;
      const all = HOST_ROSTER.filter((d) => d.rarity === r);
      const have = all.filter((d) => s.owns(d.id)).length;
      const done = have === all.length;
      const chip = document.createElement("span");
      chip.className = `bonus-chip${done ? " done" : ""}`;
      chip.dataset.rarity = r;
      chip.textContent = `${r} ${have}/${all.length}　コンプで売上+${Math.round((GACHA.collectionBonus[r] ?? 0) * 100)}%${done ? " ✓" : ""}`;
      bonuses.appendChild(chip);
    }
    this.summaryEl.appendChild(bonuses);

    const total = document.createElement("div");
    total.className = "zukan-total";
    const parts = [`図鑑ボーナス 売上+${Math.round(s.collectionBonus() * 100)}%`];
    if (s.godOnFloor()) parts.push(`神の出勤 売上+${Math.round(GACHA.godRevenueBonus * 100)}%・来店間隔−${Math.round((1 - GACHA.godSpawnFactor) * 100)}%`);
    total.textContent = parts.join("　／　");
    this.summaryEl.appendChild(total);

    // ---- カード（レア度の高い順にセクション） ----
    this.gridEl.innerHTML = "";
    for (const r of [...RARITIES].reverse()) {
      if (r === "UR" && !showUR) continue;
      const defs = HOST_ROSTER.filter((d) => d.rarity === r);
      const h3 = document.createElement("h3");
      h3.className = "panel-section";
      h3.textContent = r === "UR" ? "シークレット（神）" : r;
      this.gridEl.appendChild(h3);
      const grid = document.createElement("div");
      grid.className = "zukan-grid";
      for (const def of defs) grid.appendChild(this.buildCard(def, r, onFloor.has(def.id)));
      this.gridEl.appendChild(grid);
    }
  }

  private buildCard(def: HostDef, rarity: Rarity, floor: boolean): HTMLElement {
    const s = this.state;
    const owned = s.owns(def.id);
    const card = document.createElement("div");
    card.className = `zcard${owned ? "" : " locked"}`;
    card.dataset.rarity = rarity;

    const top = document.createElement("div");
    top.className = "zcard-top";
    top.appendChild(createPortrait(def, owned, 2));

    const head = document.createElement("div");
    head.className = "zcard-head";
    const name = document.createElement("div");
    name.className = "zcard-name";
    name.textContent = owned ? def.name : "？？？";
    const meta = document.createElement("div");
    meta.className = "zcard-meta";
    meta.textContent = owned ? `${rarity}・${def.race}` : `${rarity}・店舗${def.unlockShop}〜で出現`;
    head.append(name, meta);
    if (owned) {
      const lb = s.limitBreak(def.id);
      const stars = document.createElement("div");
      stars.className = "zcard-stars";
      stars.textContent = "★".repeat(lb) + "☆".repeat(GACHA.limitBreakMax - lb);
      head.appendChild(stars);
    }
    top.appendChild(head);
    card.appendChild(top);

    if (owned) {
      const e = hostEffect(def, s.limitBreak(def.id));
      const stats = document.createElement("div");
      stats.className = "zcard-stats";
      stats.textContent = `売上×${e.revenueMultiplier.toFixed(2)}　滞在延長+${e.extraOrders}　グレード補正${e.orderBonus}`;
      const passive = document.createElement("div");
      passive.className = "zcard-passive";
      passive.textContent = RACES[def.race].description;
      const profile = document.createElement("div");
      profile.className = "zcard-profile";
      profile.textContent = def.profile;
      const stamina = Math.round(s.stamina(def.id));
      const st = document.createElement("div");
      st.className = "zcard-stamina";
      st.innerHTML = `<span class="assign-stamina"><span class="assign-stamina-bar${stamina < 30 ? " low" : ""}" style="width:${stamina}%"></span></span> スタミナ ${stamina}`;
      const regs = s.regularsOf(def.id);
      const regEl = document.createElement("div");
      regEl.className = "zcard-regulars";
      regEl.textContent =
        regs.length === 0
          ? `太客 0 / ${REGULAR.maxPerHost}`
          : `太客 ${regs.length} / ${REGULAR.maxPerHost}: ` + regs.map((r) => `${r.name}（${r.type}・♥${Math.round(r.affinity)}）`).join("、");
      const status = document.createElement("div");
      status.className = `zcard-status${floor ? " on" : ""}`;
      status.textContent = floor ? "出勤中" : "控え";
      card.append(stats, passive, profile, st, regEl, status);
    }
    return card;
  }
}
