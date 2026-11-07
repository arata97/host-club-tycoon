import { affinityMultiplier, CUSTOMER_TYPE_DEFS, STAMINA } from "../game/data/customers";
import type { Host } from "../game/entities/host";
import type { Table } from "../game/entities/table";
import type { GameState } from "../game/state";
import { formatG } from "../game/util";
import type { World } from "../game/world";
import { BasePanel, buildPanelHead } from "./panel";

/**
 * 営業中のつけ回しポップアップ（E キー）。
 * 卓の客の情報と、出勤中のホスト一覧（相性・指名・スタミナ・状態）を出し、選ぶと入れ替える。
 * 数字キー 1〜9 で選択、0 で「外す（店長がヘルプ）」。
 */
export class AssignUI extends BasePanel {
  private table: Table | null = null;
  private readonly infoEl: HTMLElement;
  private readonly listEl: HTMLElement;
  private lastSig = "";

  constructor(
    private readonly state: GameState,
    private readonly getWorld: () => World,
  ) {
    super("assign");
    const root = this.root;
    root.innerHTML = "";
    root.appendChild(buildPanelHead("つけ回し", "1〜9 で選択 / 0 で外す / E・Esc で閉じる", () => this.close()));
    this.infoEl = document.createElement("div");
    this.infoEl.className = "assign-info";
    this.listEl = document.createElement("div");
    this.listEl.className = "assign-list";
    root.append(this.infoEl, this.listEl);

    window.addEventListener("keydown", (e) => {
      if (!this.isOpen || e.repeat) return;
      if (e.code.startsWith("Digit")) {
        const n = Number(e.code.slice(5));
        if (n === 0) this.choose(null);
        else {
          const h = this.getWorld().hosts[n - 1];
          if (h) this.choose(h);
        }
      }
    });
  }

  /** 卓を指定して開く */
  openFor(table: Table): void {
    this.table = table;
    this.openPanel();
  }

  override close(): void {
    super.close();
    this.table = null;
  }

  private choose(host: Host | null): void {
    const t = this.table;
    if (!t) return;
    if (this.getWorld().reassign(t, host)) this.close();
  }

  refresh(force = false): void {
    const t = this.table;
    const c = t?.customer;
    if (!t || !c || c.phase === "leaving" || c.phase === "gone") {
      if (this.isOpen) this.close();
      return;
    }
    const world = this.getWorld();
    const sig = `${t.index}|${t.host?.def.id}|${world.hosts.map((h) => `${h.def.id}:${h.phase}:${Math.round(h.stamina)}`).join(",")}|${Math.round(c.budget)}`;
    if (!force && sig === this.lastSig) return;
    this.lastSig = sig;

    // ---- 客の情報 ----
    const td = CUSTOMER_TYPE_DEFS[c.type];
    this.infoEl.innerHTML = "";
    const title = document.createElement("div");
    title.className = "assign-title";
    title.textContent = `${t.index + 1}番卓 ／ ${c.regular ? `${c.regular.name}（太客）` : `一見の${c.type}`}${c.vip ? " ／ VIP" : ""}`;
    const prefs = document.createElement("div");
    prefs.className = "assign-prefs";
    prefs.textContent = `好み: ${td.likes.join("・")}　苦手: ${td.dislikes ?? "なし"}　残り予算 ${formatG(c.budget)}`;
    this.infoEl.append(title, prefs);
    if (c.regular) {
      const nomDef = this.state.ownedDefs().find((d) => d.id === c.regular?.hostId);
      const nom = document.createElement("div");
      nom.className = "assign-nom";
      nom.textContent = `指名: ${nomDef?.name ?? "?"}（好感度 ${Math.round(c.regular.affinity)}）— 指名ホストが着くと売上×1.5、着かないと好感度が下がります`;
      this.infoEl.appendChild(nom);
    }

    // ---- ホスト一覧 ----
    this.listEl.innerHTML = "";
    world.hosts.forEach((h, i) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "assign-row";
      row.dataset.rarity = h.def.rarity;
      if (t.host === h) row.classList.add("current");
      const tired = h.stamina < STAMINA.minToServe;
      row.disabled = h.stamina < 1;

      const key = document.createElement("span");
      key.className = "assign-key";
      key.textContent = String(i + 1);

      const name = document.createElement("span");
      name.className = "assign-name";
      name.textContent = `${h.def.name}（${h.def.rarity}・${h.def.race}）`;

      const aff = affinityMultiplier(c.type, h.def.race);
      const tags = document.createElement("span");
      tags.className = "assign-tags";
      const parts: string[] = [];
      if (h.def.id === c.nominatedHostId) parts.push("★指名");
      if (aff > 1) parts.push("◎好み");
      else if (aff < 1) parts.push("✕苦手");
      tags.textContent = parts.join(" ");

      const st = document.createElement("span");
      st.className = "assign-stamina";
      const bar = document.createElement("span");
      bar.className = "assign-stamina-bar";
      bar.style.width = `${Math.round(h.stamina)}%`;
      if (h.stamina < 30) bar.classList.add("low");
      st.appendChild(bar);

      const status = document.createElement("span");
      status.className = "assign-status";
      if (t.host === h) status.textContent = "この卓";
      else if (h.table) status.textContent = `${h.table.index + 1}番卓から移動`;
      else status.textContent = tired ? "疲労" : "待機";

      row.append(key, name, tags, st, status);
      row.addEventListener("click", () => this.choose(h));
      this.listEl.appendChild(row);
    });

    const off = document.createElement("button");
    off.type = "button";
    off.className = "assign-row off";
    off.innerHTML = `<span class="assign-key">0</span><span class="assign-name">ホストを外す（店長がヘルプに入る）</span>`;
    off.disabled = t.host === null && t.autoBlocked;
    off.addEventListener("click", () => this.choose(null));
    this.listEl.appendChild(off);
  }
}
