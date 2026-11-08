import { ASSIGN_POLICIES, INVITE, STAMINA } from "../game/data/customers";
import { hostGuaranteeFor, HOST_WAGE, LOAN, rentDiscount, rentFor } from "../game/data/economy";
import { RACES } from "../game/data/races";
import { pendingCount } from "../game/invitations";
import type { GameState } from "../game/state";
import { formatG } from "../game/util";
import { renderInviteCard } from "./invite";
import { BasePanel, buildPanelHead } from "./panel";
import { createPortrait } from "./portrait";
import { renderReport } from "./report";

type Tab = "report" | "dohan" | "roster" | "finance";

/**
 * 経営画面（開店前）。日報の確認、借入・返済、開店ボタン。
 * ショップ／ガチャ／図鑑は別パネル（HUD のボタン・キー）から。
 */
export class OfficeUI extends BasePanel {
  private readonly summaryEl: HTMLElement;
  private readonly tabsEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private readonly openBtn: HTMLButtonElement;
  private readonly footNoteEl: HTMLElement;
  private tab: Tab = "report";
  private lastSig = "";

  constructor(
    private readonly state: GameState,
    private readonly onOpen: () => void,
    private readonly onChange: () => void,
  ) {
    super("office");
    const root = this.root;
    root.innerHTML = "";
    root.appendChild(buildPanelHead("経営", "O キーで開閉 / Esc で閉じる", () => this.close()));

    this.summaryEl = document.createElement("div");
    this.summaryEl.className = "office-summary";

    this.tabsEl = document.createElement("div");
    this.tabsEl.className = "tabs";
    for (const [key, label] of [
      ["report", "日報"],
      ["dohan", "同伴"],
      ["roster", "出勤・方針"],
      ["finance", "財務"],
    ] as const) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tab";
      b.dataset.tab = key;
      b.textContent = label;
      b.addEventListener("click", () => {
        this.tab = key;
        this.refresh(true);
      });
      this.tabsEl.appendChild(b);
    }

    this.bodyEl = document.createElement("div");
    this.bodyEl.className = "office-body";

    const foot = document.createElement("div");
    foot.className = "office-foot";
    const shortcuts = document.createElement("span");
    shortcuts.className = "office-shortcuts";
    shortcuts.textContent = "B ショップ ／ G ガチャ ／ Z 図鑑";
    this.footNoteEl = shortcuts;
    this.openBtn = document.createElement("button");
    this.openBtn.type = "button";
    this.openBtn.className = "btn-pink btn-big";
    this.openBtn.textContent = "開店する（Enter）";
    this.openBtn.addEventListener("click", () => this.onOpen());
    foot.append(shortcuts, this.openBtn);

    root.append(this.summaryEl, this.tabsEl, this.bodyEl, foot);
    this.refresh(true);
  }

  /** 未回答の同伴があれば、開いたときに同伴タブを見せる */
  override openPanel(): void {
    if (pendingCount(this.state.dohanOffers) > 0) this.tab = "dohan";
    super.openPanel();
  }

  refresh(force = false): void {
    const s = this.state;
    const dohanSig = s.dohanOffers.map((o) => `${o.id}:${o.status}`).join(",");
    const sig = `${this.tab}|${Math.floor(s.money)}|${s.debt}|${s.day}|${s.negativeDays}|${s.lastReport?.day ?? 0}|${s.policy}|${s.rosterMode}|${s.manualRoster.join(",")}|${Object.keys(s.hosts).length}|${s.tableCount}|${s.regulars.length}|${dohanSig}`;
    if (!force && sig === this.lastSig) return;
    this.lastSig = sig;

    // サマリー
    this.summaryEl.innerHTML = "";
    const day = document.createElement("div");
    day.className = "office-day";
    day.textContent = `Day ${s.day} 開店前${s.rebirths > 0 ? `（${s.rebirths}周目）` : ""}`;
    const cash = document.createElement("div");
    cash.className = `office-cash${s.money < 0 ? " warn" : ""}`;
    cash.textContent = `現金 ${formatG(s.money)}`;
    const debt = document.createElement("div");
    debt.className = "office-debt";
    debt.textContent = `借金 ${formatG(s.debt)}（日利 ${(LOAN.dailyRate * 100).toFixed(1)}% ＝ ${formatG(Math.round(s.debt * LOAN.dailyRate))}/日）`;
    this.summaryEl.append(day, cash, debt);
    if (s.negativeDays > 0) {
      const warn = document.createElement("div");
      warn.className = "office-warn";
      warn.textContent = `⚠ 現金がマイナスの状態が ${s.negativeDays} 日続いています（${LOAN.bankruptDays} 日で倒産）。財務タブで借入を検討してください`;
      this.summaryEl.appendChild(warn);
    }

    const pending = pendingCount(s.dohanOffers);
    for (const b of this.tabsEl.querySelectorAll<HTMLButtonElement>(".tab")) {
      b.classList.toggle("active", b.dataset.tab === this.tab);
      if (b.dataset.tab === "dohan") b.textContent = pending > 0 ? `同伴（${pending}）` : "同伴";
    }
    this.footNoteEl.textContent =
      pending > 0 ? `未回答の同伴 ${pending} 件は、開店すると断ったことになります` : "B ショップ ／ G ガチャ ／ Z 図鑑";
    this.footNoteEl.classList.toggle("warn", pending > 0);

    this.bodyEl.innerHTML = "";
    if (this.tab === "report") this.renderReportTab();
    else if (this.tab === "dohan") this.renderDohanTab();
    else if (this.tab === "roster") this.renderRosterTab();
    else this.renderFinanceTab();
  }

  private renderDohanTab(): void {
    const s = this.state;
    const wrap = document.createElement("div");
    wrap.className = "invite-section";
    if (s.dohanOffers.length === 0) {
      const none = document.createElement("div");
      none.className = "office-empty";
      none.innerHTML = `今日の同伴の誘いはありません。<br>好感度 ${INVITE.dohanMinAffinity} 以上の太客から、閉店後に誘いが届きます。`;
      wrap.appendChild(none);
    }
    const note = document.createElement("div");
    note.className = "finance-note";
    note.textContent = `受けられるのは1ホスト1件、合計で卓数（${s.tableCount}件）までです。同伴を受けたホストは出勤が確定します。`;
    if (s.dohanOffers.length > 0) wrap.appendChild(note);
    for (const inv of s.dohanOffers) {
      wrap.appendChild(
        renderInviteCard(s, inv, () => {
          this.onChange();
          this.refresh(true);
        }),
      );
    }
    this.bodyEl.appendChild(wrap);
  }

  private renderRosterTab(): void {
    const s = this.state;
    const wrap = document.createElement("div");
    wrap.className = "roster";

    // ---- つけ回し方針 ----
    const ph = document.createElement("div");
    ph.className = "finance-title";
    ph.textContent = "つけ回し方針（営業中は卓の近くで E キーを押すと手動で入れ替えられます）";
    wrap.appendChild(ph);
    const policies = document.createElement("div");
    policies.className = "policy-list";
    for (const p of ASSIGN_POLICIES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `policy${s.policy === p.key ? " active" : ""}`;
      b.innerHTML = `<b>${p.label}</b><span>${p.desc}</span>`;
      b.addEventListener("click", () => {
        s.policy = p.key;
        this.onChange();
        this.refresh(true);
      });
      policies.appendChild(b);
    }
    wrap.appendChild(policies);

    // ---- 出勤メンバー ----
    const owned = s.ownedDefs();
    const onFloor = new Set(s.onFloorDefs().map((d) => d.id));
    const head = document.createElement("div");
    head.className = "roster-head";
    const rh = document.createElement("div");
    rh.className = "finance-title";
    rh.textContent = `出勤メンバー ${onFloor.size} / ${s.tableCount} 枠（${s.rosterMode === "auto" ? "自動: レア度順" : "手動"}）`;
    head.appendChild(rh);
    if (s.rosterMode === "manual") {
      const auto = document.createElement("button");
      auto.type = "button";
      auto.className = "btn-gold";
      auto.textContent = "自動に戻す";
      auto.addEventListener("click", () => {
        s.setRosterAuto();
        this.onChange();
        this.refresh(true);
      });
      head.appendChild(auto);
    }
    wrap.appendChild(head);

    if (owned.length === 0) {
      const none = document.createElement("div");
      none.className = "office-empty";
      none.textContent = "ホストがいません。ガチャ（G）で獲得してください。";
      wrap.appendChild(none);
    }

    const note = document.createElement("div");
    note.className = "finance-note";
    note.textContent = `出勤させたホストにだけ給与（歩合 or 最低保証）が発生します。控えは無給で、開店時のスタミナ回復が多め（出勤 +${STAMINA.recoverOnFloor} ／ 控え +${STAMINA.recoverBench}）。スタミナが低いと接客効果が落ち、${STAMINA.minToServe} 未満では卓に着けません。`;
    wrap.appendChild(note);

    const list = document.createElement("div");
    list.className = "roster-list";
    for (const d of owned) {
      const on = onFloor.has(d.id);
      const row = document.createElement("button");
      row.type = "button";
      row.className = `roster-row${on ? " on" : ""}`;
      row.dataset.rarity = d.rarity;
      const stamina = s.stamina(d.id);
      const regs = s.regularsOf(d.id).length;
      const guarantee = hostGuaranteeFor(d.rarity, s.shopLevel);

      const check = document.createElement("span");
      check.className = "roster-check";
      check.textContent = s.pinnedHostIds().has(d.id) ? "✔ 同伴" : on ? "✔ 出勤" : "控え";
      const info = document.createElement("span");
      info.className = "roster-info";
      info.innerHTML = `<b>${d.name}</b> <small>${d.rarity}・${d.race}${s.limitBreak(d.id) ? ` +${s.limitBreak(d.id)}` : ""}</small><br>
        <small>${RACES[d.race].description}</small><br>
        <small>歩合 ${Math.round(HOST_WAGE.rate[d.rarity] * 100)}% ／ 最低保証 ${formatG(guarantee)} ／ 太客 ${regs} 人</small>`;
      const st = document.createElement("span");
      st.className = "roster-stamina";
      st.innerHTML = `<span class="assign-stamina"><span class="assign-stamina-bar${stamina < 30 ? " low" : ""}" style="width:${Math.round(stamina)}%"></span></span><small>スタミナ ${Math.round(stamina)}</small>`;

      row.append(createPortrait(d, true, 2), check, info, st);
      row.addEventListener("click", () => {
        if (!s.toggleRoster(d.id)) {
          row.classList.add("shake");
          setTimeout(() => row.classList.remove("shake"), 300);
          return;
        }
        this.onChange();
        this.refresh(true);
      });
      list.appendChild(row);
    }
    wrap.appendChild(list);

    this.bodyEl.appendChild(wrap);
  }

  private renderReportTab(): void {
    const r = this.state.lastReport;
    if (!r) {
      const el = document.createElement("div");
      el.className = "office-empty";
      el.innerHTML = `まだ日報はありません。<br>開店して最初の営業日を終えると、売上と支出の内訳がここに出ます。<br><br>
        <b>今日の固定費の見込み</b>: 家賃 ${formatG(Math.round(rentFor(this.state.shopLevel) * (1 - rentDiscount(this.state.rebirths))))}
        ＋ 利息 ${formatG(Math.round(this.state.debt * LOAN.dailyRate))} ＋ 給与（出勤させた人数による）`;
      this.bodyEl.appendChild(el);
      return;
    }
    this.bodyEl.appendChild(renderReport(r));
  }

  private renderFinanceTab(): void {
    const s = this.state;
    const wrap = document.createElement("div");
    wrap.className = "finance";

    const info = document.createElement("div");
    info.className = "finance-info";
    info.innerHTML = `借金残高の上限 <b>${formatG(s.borrowLimit())}</b>（開業資金 ${formatG(LOAN.initialDebt)} ＋ 直近7日の売上 × 3、最低 ${formatG(LOAN.limitFloor)}）<br>
      いま借りられる額 <b>${formatG(s.borrowable())}</b>`;
    wrap.appendChild(info);

    const mk = (label: string, title: string, amounts: Array<[string, () => number]>, act: (n: number) => boolean) => {
      const sec = document.createElement("div");
      sec.className = "finance-sec";
      const h = document.createElement("div");
      h.className = "finance-title";
      h.textContent = title;
      sec.appendChild(h);
      const btns = document.createElement("div");
      btns.className = "finance-btns";
      for (const [text, calc] of amounts) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = label === "borrow" ? "btn-gold" : "btn-pink";
        const n = calc();
        b.textContent = `${text}${text.endsWith("額") ? "" : ""}`;
        b.disabled = n <= 0;
        b.title = formatG(n);
        b.addEventListener("click", () => {
          if (act(calc())) {
            this.onChange();
            this.refresh(true);
          }
        });
        btns.appendChild(b);
      }
      sec.appendChild(btns);
      return sec;
    };

    wrap.appendChild(
      mk(
        "borrow",
        "借入",
        [
          ["10万G", () => Math.min(100_000, s.borrowable())],
          ["50万G", () => Math.min(500_000, s.borrowable())],
          ["100万G", () => Math.min(1_000_000, s.borrowable())],
          ["上限まで", () => s.borrowable()],
        ],
        (n) => s.borrow(n),
      ),
    );
    wrap.appendChild(
      mk(
        "repay",
        "返済",
        [
          ["10万G", () => Math.min(100_000, s.debt, Math.max(0, s.money))],
          ["50万G", () => Math.min(500_000, s.debt, Math.max(0, s.money))],
          ["100万G", () => Math.min(1_000_000, s.debt, Math.max(0, s.money))],
          ["全額", () => Math.min(s.debt, Math.max(0, s.money))],
        ],
        (n) => s.repay(n),
      ),
    );

    const note = document.createElement("div");
    note.className = "finance-note";
    note.textContent =
      "利息は閉店時に借金残高へ加算されます。閉店時に現金がマイナスだと「赤字日数」が増え、3日続くと倒産（再転生）。開店前に借入で現金をプラスにすれば回避できます。";
    wrap.appendChild(note);

    this.bodyEl.appendChild(wrap);
  }
}
