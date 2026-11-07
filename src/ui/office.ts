import { LOAN, rentDiscount, rentFor } from "../game/data/economy";
import type { GameState } from "../game/state";
import { formatG } from "../game/util";
import { BasePanel, buildPanelHead } from "./panel";
import { renderReport } from "./report";

type Tab = "report" | "finance";

/**
 * 経営画面（開店前）。日報の確認、借入・返済、開店ボタン。
 * ショップ／ガチャ／図鑑は別パネル（HUD のボタン・キー）から。
 */
export class OfficeUI extends BasePanel {
  private readonly summaryEl: HTMLElement;
  private readonly tabsEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private readonly openBtn: HTMLButtonElement;
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
    this.openBtn = document.createElement("button");
    this.openBtn.type = "button";
    this.openBtn.className = "btn-pink btn-big";
    this.openBtn.textContent = "開店する（Enter）";
    this.openBtn.addEventListener("click", () => this.onOpen());
    foot.append(shortcuts, this.openBtn);

    root.append(this.summaryEl, this.tabsEl, this.bodyEl, foot);
    this.refresh(true);
  }

  refresh(force = false): void {
    const s = this.state;
    const sig = `${this.tab}|${Math.floor(s.money)}|${s.debt}|${s.day}|${s.negativeDays}|${s.lastReport?.day ?? 0}`;
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

    for (const b of this.tabsEl.querySelectorAll<HTMLButtonElement>(".tab")) b.classList.toggle("active", b.dataset.tab === this.tab);

    this.bodyEl.innerHTML = "";
    if (this.tab === "report") this.renderReportTab();
    else this.renderFinanceTab();
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
