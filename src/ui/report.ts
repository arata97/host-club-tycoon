import type { DayReport } from "../game/ledger";
import { formatG } from "../game/util";

function row(label: string, value: string, cls = ""): HTMLElement {
  const el = document.createElement("div");
  el.className = `rep-row ${cls}`.trim();
  const l = document.createElement("span");
  l.textContent = label;
  const v = document.createElement("span");
  v.className = "rep-val";
  v.textContent = value;
  el.append(l, v);
  return el;
}

/** 日報の DOM を作る（開店前の「日報」タブと閉店精算で共用） */
export function renderReport(r: DayReport): HTMLElement {
  const root = document.createElement("div");
  root.className = "report";

  const head = document.createElement("div");
  head.className = "rep-head";
  head.textContent = `Day ${r.day} の日報`;
  root.appendChild(head);

  const cols = document.createElement("div");
  cols.className = "rep-cols";

  const left = document.createElement("div");
  left.className = "rep-col";
  left.append(
    row("売上", formatG(r.sales), "plus"),
    row(`　来店 ${r.customers} 組（VIP ${r.vipVisits}）／ 提供 ${r.bottles} 本`, ""),
    row(`　待ちきれず退店 ${r.walkouts} 組`, "", r.walkouts > 0 ? "warn" : ""),
    row("原価（売価の30%）", `−${formatG(r.cogs)}`, "minus"),
    row("内勤給与", `−${formatG(r.staffWages)}`, "minus"),
    row("ホスト給与", `−${formatG(r.hostWages)}`, "minus"),
    row("家賃", `−${formatG(r.rent)}`, "minus"),
    row("借金利息", `−${formatG(r.interest)}`, "minus"),
    row("純利益", `${r.net >= 0 ? "+" : "−"}${formatG(Math.abs(r.net))}`, r.net >= 0 ? "total plus" : "total minus"),
    row("現金", formatG(r.cashAfter), r.cashAfter < 0 ? "warn" : ""),
    row("借金残高", formatG(r.debtAfter)),
  );
  cols.appendChild(left);

  const right = document.createElement("div");
  right.className = "rep-col";
  const ht = document.createElement("div");
  ht.className = "rep-sub";
  ht.textContent = "ホスト別成績（担当売上 → 給与）";
  right.appendChild(ht);
  if (r.hostPays.length === 0) {
    const none = document.createElement("div");
    none.className = "rep-none";
    none.textContent = "出勤したホストはいません";
    right.appendChild(none);
  }
  for (const p of r.hostPays) {
    const el = document.createElement("div");
    el.className = "rep-host";
    el.dataset.rarity = p.rarity;
    const name = document.createElement("span");
    name.className = "rep-host-name";
    name.textContent = `${p.name}`;
    const sales = document.createElement("span");
    sales.textContent = formatG(p.sales);
    const pay = document.createElement("span");
    pay.className = "rep-host-pay";
    const byGuarantee = p.guarantee > p.commission;
    pay.textContent = `→ ${formatG(p.paid)}${byGuarantee ? "（最低保証）" : ""}`;
    if (byGuarantee) pay.classList.add("warn");
    el.append(name, sales, pay);
    right.appendChild(el);
  }
  if (r.salesByPlayer > 0) right.appendChild(row("店長の接客売上", formatG(r.salesByPlayer)));
  cols.appendChild(right);

  root.appendChild(cols);
  return root;
}
