import { rentDiscount, startingCash } from "../game/data/economy";
import { declineAllPending, pendingCount } from "../game/invitations";
import type { DayReport } from "../game/ledger";
import type { GameState } from "../game/state";
import { formatG } from "../game/util";
import { renderInviteCard } from "./invite";
import { renderReport } from "./report";

/**
 * 閉店精算画面と倒産（再転生）画面。中央のモーダル。
 * 閉店時はアフターの誘いに答えてから翌日へ進む。
 */
export class ClosingUI {
  private readonly root: HTMLElement;
  private report: DayReport | null = null;

  constructor(
    private readonly state: GameState,
    private readonly onNextDay: () => void,
    private readonly onReincarnate: () => void,
  ) {
    const root = document.getElementById("closing");
    if (!root) throw new Error("#closing が見つかりません");
    this.root = root;
  }

  showReport(r: DayReport): void {
    this.report = r;
    this.renderReportView();
    this.root.classList.add("open");
  }

  private renderReportView(): void {
    const r = this.report;
    if (!r) return;
    this.root.innerHTML = "";
    const box = document.createElement("div");
    box.className = "modal";

    const h2 = document.createElement("h2");
    h2.textContent = `Day ${r.day} 閉店`;
    box.appendChild(h2);

    const verdict = document.createElement("div");
    verdict.className = `closing-verdict ${r.net >= 0 ? "plus" : "minus"}`;
    verdict.textContent = r.net >= 0 ? `本日の純利益 +${formatG(r.net)}` : `本日は赤字 −${formatG(Math.abs(r.net))}`;
    box.appendChild(verdict);

    box.appendChild(renderReport(r));

    if (this.state.negativeDays > 0) {
      const warn = document.createElement("div");
      warn.className = "closing-warn";
      warn.textContent = `⚠ 現金がマイナスです（${this.state.negativeDays} 日目）。3日続くと倒産します。翌日の開店前に借入で補填できます。`;
      box.appendChild(warn);
    }

    const offers = this.state.afterOffers;
    if (offers.length > 0) {
      const sec = document.createElement("div");
      sec.className = "invite-section";
      const h3 = document.createElement("h3");
      h3.className = "panel-section";
      h3.textContent = "アフターの誘い（1ホスト1件まで）";
      sec.appendChild(h3);
      for (const inv of offers) sec.appendChild(renderInviteCard(this.state, inv, () => this.renderReportView()));
      box.appendChild(sec);
    }

    const pending = pendingCount(offers);
    const actions = document.createElement("div");
    actions.className = "closing-actions";
    if (pending > 0) {
      const declineAll = document.createElement("button");
      declineAll.type = "button";
      declineAll.className = "btn-ghost";
      declineAll.textContent = `残り ${pending} 件をすべて断る`;
      declineAll.addEventListener("click", () => {
        declineAllPending(this.state, offers);
        this.renderReportView();
      });
      actions.appendChild(declineAll);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-gold btn-big";
    btn.textContent = pending > 0 ? "誘いに答えてください" : "翌日へ";
    btn.disabled = pending > 0;
    btn.addEventListener("click", () => this.onNextDay());
    actions.appendChild(btn);
    box.appendChild(actions);

    this.root.appendChild(box);
  }

  showBankrupt(): void {
    const s = this.state;
    this.root.innerHTML = "";
    const box = document.createElement("div");
    box.className = "modal bankrupt";

    const h2 = document.createElement("h2");
    h2.textContent = "倒産……";
    const p = document.createElement("p");
    p.innerHTML = `Day ${s.day}、現金 ${formatG(s.money)}、借金 ${formatG(s.debt)}。<br>
      店は差し押さえられ、あなたは夜の街を後にした——<br><br>
      <b>……目を覚ますと、そこはまた異世界だった。</b>`;
    box.append(h2, p);

    const next = s.rebirths + 1;
    const keep = document.createElement("div");
    keep.className = "rebirth-info";
    keep.innerHTML = `<div class="rebirth-col"><b>引き継ぐもの</b><ul>
        <li>図鑑（所持ホスト ${Object.keys(s.hosts).length} 人・限界突破）</li>
        <li>ガチャの天井カウンター</li>
        <li>${next}周目ボーナス: 開始資金 ${formatG(startingCash(next))}、家賃 −${Math.round(rentDiscount(next) * 100)}%</li>
      </ul></div>
      <div class="rebirth-col"><b>失うもの</b><ul>
        <li>現金・借金</li>
        <li>店舗・テーブル・酒蔵・内勤</li>
        <li>店長の強化・太客</li>
      </ul></div>`;
    box.appendChild(keep);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-pink btn-big";
    btn.textContent = "再転生する";
    btn.addEventListener("click", () => this.onReincarnate());
    box.appendChild(btn);

    this.root.appendChild(box);
    this.root.classList.add("open");
  }

  hide(): void {
    this.report = null;
    this.root.classList.remove("open");
    this.root.innerHTML = "";
  }
}
