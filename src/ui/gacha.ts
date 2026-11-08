import { sfx } from "../engine/audio";
import { gachaPrice, gachaRates, pityRarity, RARITIES, type Rarity } from "../game/data/balance";
import { RACES } from "../game/data/races";
import { hostEffect } from "../game/entities/host";
import { canPull, type PullResult, pull, pullsUntilPity } from "../game/gacha";
import type { GameState } from "../game/state";
import { formatG } from "../game/util";
import { BasePanel, buildPanelHead } from "./panel";
import { createPortrait } from "./portrait";

const RARITY_LABEL: Record<Rarity, string> = { N: "N", R: "R", SR: "SR", SSR: "SSR", UR: "UR" };

/** ホストガチャのパネル */
export class GachaUI extends BasePanel {
  private readonly infoEl: HTMLElement;
  private readonly ratesEl: HTMLElement;
  private readonly singleBtn: HTMLButtonElement;
  private readonly multiBtn: HTMLButtonElement;
  private readonly resultsEl: HTMLElement;
  private lastSig = "";

  constructor(
    private readonly state: GameState,
    private readonly onChange: () => void,
  ) {
    super("gacha");
    const root = this.root;
    root.innerHTML = "";
    root.appendChild(buildPanelHead("ホストガチャ", "G キーで開閉 / Esc で閉じる", () => this.close()));

    this.infoEl = document.createElement("div");
    this.infoEl.className = "gacha-info";
    this.ratesEl = document.createElement("div");
    this.ratesEl.className = "gacha-rates";

    const actions = document.createElement("div");
    actions.className = "gacha-actions";
    this.singleBtn = this.makeButton(false);
    this.multiBtn = this.makeButton(true);
    actions.append(this.singleBtn, this.multiBtn);

    this.resultsEl = document.createElement("div");
    this.resultsEl.className = "gacha-results";
    this.resultsEl.innerHTML = `<p class="gacha-empty">ガチャを引くとここに結果が表示されます</p>`;

    root.append(this.infoEl, this.ratesEl, actions, this.resultsEl);
    this.refresh(true);
  }

  private makeButton(multi: boolean): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = multi ? "btn-gold btn-big" : "btn-pink btn-big";
    btn.addEventListener("click", () => {
      const results = pull(this.state, multi);
      if (!results) return;
      this.onChange();
      this.showResults(results);
      this.refresh(true);
    });
    return btn;
  }

  private showResults(results: PullResult[]): void {
    this.resultsEl.innerHTML = "";
    results.forEach((r, i) => {
      const card = document.createElement("div");
      card.className = "gcard";
      card.dataset.rarity = r.def.rarity;
      card.style.animationDelay = `${i * 70}ms`;

      const badge = document.createElement("div");
      badge.className = "gcard-rarity";
      badge.textContent = RARITY_LABEL[r.def.rarity];

      const name = document.createElement("div");
      name.className = "gcard-name";
      name.textContent = r.def.name;

      const race = document.createElement("div");
      race.className = "gcard-race";
      race.textContent = r.def.race;

      const tag = document.createElement("div");
      tag.className = "gcard-tag";
      if (r.isNew) {
        tag.textContent = "NEW!";
        tag.classList.add("new");
      } else if (r.refund > 0) {
        tag.textContent = `MAX → ${formatG(r.refund)}`;
      } else {
        tag.textContent = `限界突破 +${r.limitBreak}`;
      }
      if (r.pityHit) {
        const pity = document.createElement("div");
        pity.className = "gcard-pity";
        pity.textContent = "天井";
        card.appendChild(pity);
      }

      card.append(badge, createPortrait(r.def, true, 2), name, race, tag);
      this.resultsEl.appendChild(card);
    });

    // 最高レアの演出
    const best = results.reduce((a, b) => (RARITIES.indexOf(b.def.rarity) > RARITIES.indexOf(a.def.rarity) ? b : a));
    sfx.play(best.def.rarity === "UR" ? "god" : best.def.rarity === "SSR" || best.def.rarity === "SR" ? "rare" : "gacha");
    this.root.classList.remove("flash-SSR", "flash-UR");
    if (best.def.rarity === "SSR" || best.def.rarity === "UR") {
      void this.root.offsetWidth; // アニメーション再始動
      this.root.classList.add(`flash-${best.def.rarity}`);
    }
    // 神を引いたときだけ専用メッセージ
    const god = results.find((r) => r.def.race === "神" && r.isNew);
    if (god) {
      const msg = document.createElement("div");
      msg.className = "gacha-god";
      const e = hostEffect(god.def, 0);
      msg.textContent = `✨ シークレット「${god.def.name}」が降臨！ ${RACES.神.description}（卓の売上×${e.revenueMultiplier}）`;
      this.resultsEl.prepend(msg);
    }
  }

  refresh(force = false): void {
    const s = this.state;
    const sig = `${Math.floor(s.money)}|${s.pity}|${s.shopLevel}|${s.totalPulls}`;
    if (!force && sig === this.lastSig) return;
    this.lastSig = sig;

    const lv = s.shopLevel;
    const pr = pityRarity(lv);
    this.infoEl.innerHTML = "";
    const left = document.createElement("span");
    left.textContent = `店舗${lv} のガチャ`;
    const pity = document.createElement("span");
    pity.className = "gacha-pity";
    pity.textContent = `${pr} 以上確定まで あと ${pullsUntilPity(s)} 回`;
    const money = document.createElement("span");
    money.className = "gacha-money";
    money.textContent = `所持金 ${formatG(s.money)}`;
    this.infoEl.append(left, pity, money);

    const rates = gachaRates(lv);
    this.ratesEl.innerHTML = "";
    for (const r of RARITIES) {
      if (rates[r] <= 0) continue;
      const chip = document.createElement("span");
      chip.className = "rate-chip";
      chip.dataset.rarity = r;
      chip.textContent = r === "UR" ? `??? ${rates[r]}%` : `${r} ${rates[r]}%`;
      this.ratesEl.appendChild(chip);
    }

    this.singleBtn.textContent = `単発  ${formatG(gachaPrice(lv, false))}`;
    this.multiBtn.textContent = `10連  ${formatG(gachaPrice(lv, true))}`;
    this.singleBtn.disabled = !canPull(s, false);
    this.multiBtn.disabled = !canPull(s, true);
  }
}
