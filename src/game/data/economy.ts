import type { Rarity } from "./balance";

/**
 * 経営サイクルの定数。要件定義書 §10。
 * 数値はすべて仮（フェーズ3e で調整）。
 */

/** 時間。ゲーム内1分＝リアル1秒 */
export const DAY = {
  /** 営業開始 20:00 を 0 分とする */
  openHour: 20,
  /** 営業時間（分） */
  lengthMin: 240,
  /** ラストオーダー（分）。以降は新規来店なし */
  lastOrderMin: 210,
  /** 24:00 を過ぎてから、残った客が退店しきるまでの猶予（秒） */
  closeGraceSec: 20,
} as const;

/** 支出 */
export const EXPENSES = {
  /** 原価率（提供したボトルの売価に対して） */
  cogsRate: 0.3,
  /** 店舗レベル別の家賃（日額） */
  rentByShop: [0, 20_000, 100_000, 500_000, 2_500_000, 10_000_000, 30_000_000] as readonly number[],
  /** 内勤の日給（教育Lvごとに +5%） */
  staffWageBase: 8_000,
  staffWagePerLevel: 0.05,
} as const;

/** ホスト給与: 歩合率＋最低保証（店舗レベルでスケール） */
export const HOST_WAGE = {
  rate: { N: 0.4, R: 0.45, SR: 0.5, SSR: 0.55, UR: 0.6 } as Record<Rarity, number>,
  guaranteeBase: { N: 5_000, R: 10_000, SR: 30_000, SSR: 100_000, UR: 300_000 } as Record<Rarity, number>,
  guaranteeScaleByShop: [0, 1, 3, 10, 30, 100, 300] as readonly number[],
} as const;

export function rentFor(shopLevel: number): number {
  return EXPENSES.rentByShop[shopLevel] ?? EXPENSES.rentByShop[EXPENSES.rentByShop.length - 1] ?? 0;
}
export function staffWageFor(staffLevel: number): number {
  return Math.round(EXPENSES.staffWageBase * (1 + EXPENSES.staffWagePerLevel * staffLevel));
}
export function hostGuaranteeFor(rarity: Rarity, shopLevel: number): number {
  const scale = HOST_WAGE.guaranteeScaleByShop[shopLevel] ?? 1;
  return HOST_WAGE.guaranteeBase[rarity] * scale;
}

/** 借金 */
export const LOAN = {
  /** 開業資金（初期借金） */
  initialDebt: 1_000_000,
  /** 開始時の手元現金 */
  initialCash: 200_000,
  /** 日利 */
  dailyRate: 0.003,
  /** 追加借入の上限 = max(floor, 直近7日の売上合計 × multiplier) */
  limitFloor: 500_000,
  limitSalesDays: 7,
  limitMultiplier: 3,
  /** 現金マイナスがこの日数続くと倒産 */
  bankruptDays: 3,
} as const;

/** 再転生（周回） */
export const REBIRTH = {
  /** 転生1回ごとの開始資金ボーナス */
  cashBonusPerRebirth: 0.1,
  /** 転生1回ごとの家賃割引（上限あり） */
  rentDiscountPerRebirth: 0.05,
  rentDiscountMax: 0.5,
} as const;

export function startingCash(rebirths: number): number {
  return Math.round(LOAN.initialCash * (1 + REBIRTH.cashBonusPerRebirth * rebirths));
}
export function rentDiscount(rebirths: number): number {
  return Math.min(REBIRTH.rentDiscountMax, REBIRTH.rentDiscountPerRebirth * rebirths);
}

/** 客の滞在（§10.1）。ホストが着いていると滞在が延びて注文が続く */
export const STAY = {
  /** 基本滞在（分） */
  baseMin: 45,
  baseMax: 60,
  /** 接客効果 extraOrders 1 につき延びる滞在（分） */
  perExtraOrder: 12,
  /** 滞在上限（分） */
  cap: 150,
} as const;

/** 20:00 基準の分を "HH:MM" にする */
export function formatClock(min: number): string {
  const total = DAY.openHour * 60 + Math.max(0, Math.floor(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
