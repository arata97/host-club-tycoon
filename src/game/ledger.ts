import { type Rarity, rarityRank } from "./data/balance";
import { EXPENSES, HOST_WAGE, hostGuaranteeFor, LOAN, rentDiscount, rentFor, staffWageFor } from "./data/economy";
import { hostById } from "./data/hosts";
import type { Product } from "./data/products";
import type { GameState } from "./state";

/** 1営業日の売上の記録。営業中に World が書き込み、閉店時に精算する */
export class DayLedger {
  sales = 0;
  /** 原価（提供したボトルの売価 × 原価率の合計） */
  cogs = 0;
  bottles = 0;
  customers = 0;
  /** 待ちきれず帰った客 */
  walkouts = 0;
  vipVisits = 0;
  /** ホストごとの担当売上（歩合計算用） */
  salesByHost: Record<string, number> = {};
  /** 店長が接客した売上 */
  salesByPlayer = 0;
  /** 太客の来店数／新しく太客になった数／離れた太客 */
  regularVisits = 0;
  newRegulars: string[] = [];
  lostRegulars: string[] = [];
  /** 指名ホストが接客できた指名客の数 */
  nominationsServed = 0;
  /** 予算を使い切って帰った客 */
  budgetOuts = 0;

  recordSale(amount: number, product: Product, hostId: string | null, byPlayer: boolean): void {
    this.sales += amount;
    this.cogs += Math.round(product.price * EXPENSES.cogsRate);
    this.bottles += 1;
    if (hostId) this.salesByHost[hostId] = (this.salesByHost[hostId] ?? 0) + amount;
    else if (byPlayer) this.salesByPlayer += amount;
  }
}

export interface HostPay {
  id: string;
  name: string;
  rarity: Rarity;
  sales: number;
  commission: number;
  guarantee: number;
  /** 実際の支払額 = max(歩合, 最低保証) */
  paid: number;
}

/** 日報。閉店精算の結果 */
export interface DayReport {
  day: number;
  sales: number;
  cogs: number;
  staffWages: number;
  hostWages: number;
  hostPays: HostPay[];
  rent: number;
  interest: number;
  expenses: number;
  net: number;
  bottles: number;
  customers: number;
  walkouts: number;
  vipVisits: number;
  salesByPlayer: number;
  cashAfter: number;
  debtAfter: number;
  regularVisits: number;
  newRegulars: string[];
  lostRegulars: string[];
  nominationsServed: number;
  budgetOuts: number;
}

/**
 * 閉店精算。支出を計算して現金・借金を更新し、日報を返す。
 * onFloorIds: その日出勤していたホスト（控えは無給）
 */
export function settleDay(state: GameState, ledger: DayLedger, onFloorIds: readonly string[]): DayReport {
  const staffWages = staffWageFor(state.staffLevel) * state.staffCount;

  const hostPays: HostPay[] = onFloorIds
    .map((id) => {
      const def = hostById(id);
      if (!def) return null;
      const sales = ledger.salesByHost[id] ?? 0;
      const commission = Math.round(sales * HOST_WAGE.rate[def.rarity]);
      const guarantee = hostGuaranteeFor(def.rarity, state.shopLevel);
      return { id, name: def.name, rarity: def.rarity, sales, commission, guarantee, paid: Math.max(commission, guarantee) };
    })
    .filter((p): p is HostPay => p !== null)
    .sort((a, b) => b.sales - a.sales || rarityRank(b.rarity) - rarityRank(a.rarity));
  const hostWages = hostPays.reduce((a, p) => a + p.paid, 0);

  const rent = Math.round(rentFor(state.shopLevel) * (1 - rentDiscount(state.rebirths)));
  const interest = Math.round(state.debt * LOAN.dailyRate);
  const expenses = ledger.cogs + staffWages + hostWages + rent + interest;
  const net = ledger.sales - expenses;

  state.money -= expenses;
  state.debt += interest;
  state.recordDaySales(ledger.sales);
  state.negativeDays = state.money < 0 ? state.negativeDays + 1 : 0;

  return {
    day: state.day,
    sales: ledger.sales,
    cogs: ledger.cogs,
    staffWages,
    hostWages,
    hostPays,
    rent,
    interest,
    expenses,
    net,
    bottles: ledger.bottles,
    customers: ledger.customers,
    walkouts: ledger.walkouts,
    vipVisits: ledger.vipVisits,
    salesByPlayer: ledger.salesByPlayer,
    cashAfter: state.money,
    debtAfter: state.debt,
    regularVisits: ledger.regularVisits,
    newRegulars: [...ledger.newRegulars],
    lostRegulars: [...ledger.lostRegulars],
    nominationsServed: ledger.nominationsServed,
    budgetOuts: ledger.budgetOuts,
  };
}
