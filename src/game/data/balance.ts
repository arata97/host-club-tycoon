/**
 * ゲームバランスの定数。プレイテストで調整する想定なので一箇所に集約する。
 */

export interface UpgradeDef {
  /** 初回コスト */
  base: number;
  /** 購入ごとの倍率 */
  growth: number;
  /** 購入可能回数の上限 */
  max: number;
}

export const UPGRADES = {
  /** テーブル増設（初期1卓） */
  table: { base: 5_000, growth: 1.8, max: 7 } satisfies UpgradeDef,
  /** 酒蔵Lv（初期Lv1）。Lv3でグレード2、Lv6でグレード3が解放 */
  cellar: { base: 8_000, growth: 2.0, max: 10 } satisfies UpgradeDef,
  /** 主人公の移動速度 +10%/Lv */
  speed: { base: 3_000, growth: 1.7, max: 10 } satisfies UpgradeDef,
  /** 主人公の運搬数 +1/Lv（初期2） */
  carry: { base: 4_000, growth: 1.7, max: 8 } satisfies UpgradeDef,
  /** 内勤（黒服）の人数 */
  staff: { base: 15_000, growth: 1.6, max: 6 } satisfies UpgradeDef,
  /** 内勤教育Lv: 全内勤の速度 +10%/Lv、運搬数 +1/2Lv */
  staffLv: { base: 6_000, growth: 1.8, max: 10 } satisfies UpgradeDef,
} as const;

export type UpgradeKey = keyof typeof UPGRADES;

/** n 回目（0始まり）の購入コスト */
export function upgradeCost(key: UpgradeKey, owned: number): number {
  const def = UPGRADES[key];
  return Math.round(def.base * Math.pow(def.growth, owned));
}

export const CUSTOMER = {
  /** 来店間隔（秒）。テーブル数が増えるほど短くなる */
  spawnIntervalBase: 7,
  spawnIntervalMin: 2.5,
  /** 注文を待てる時間（ゲーム内分＝秒）。超えると帰る */
  patience: 20,
  /** 1杯を飲む時間（ゲーム内分＝秒） */
  drinkTime: 12,
  /** 歩行速度（論理px/秒） */
  walkSpeed: 55,
  vipChance: 0.05,
  vipMultiplier: 3,
} as const;

export const CELLAR = {
  /** 在庫上限 = base + perLevel × (Lv-1) */
  capacityBase: 4,
  capacityPerLevel: 2,
  /** 1本補充にかかる秒数 = regenBase / (1 + regenPerLevel × (Lv-1)) */
  regenBase: 2.0,
  regenPerLevel: 0.25,
  /** 回収間隔（秒/本） */
  pickupInterval: 0.2,
} as const;

/** 接客中の効果。ホストのレア度・種族・限界突破、または主人公から算出する */
export interface HostingEffect {
  /** 着いている卓の売上倍率 */
  revenueMultiplier: number;
  /** 客が追加で注文する杯数 */
  extraOrders: number;
  /** 高グレードを注文しやすくする度合い（0〜4） */
  orderBonus: number;
  /** 我慢ゲージ減少倍率（小さいほど客が帰りにくい） */
  patienceDrain: number;
}

export const PLAYER = {
  speedBase: 90,
  speedPerLevel: 0.1,
  carryBase: 2,
  /** 回収・提供・接客が発生する距離（論理px） */
  interactRadius: 26,
  serveInterval: 0.3,
  /** 主人公が卓に立って接客するときの効果（N ホスト相当） */
  hosting: { revenueMultiplier: 1.0, extraOrders: 1, orderBonus: 0, patienceDrain: 0.5 } satisfies HostingEffect,
} as const;

/** 内勤（黒服）: 運搬専門 */
export const STAFF = {
  speedBase: 70,
  speedPerLevel: 0.1,
  carryBase: 2,
  /** 2Lv ごとに運搬数 +1 */
  carryPerLevels: 2,
} as const;

export type Rarity = "N" | "R" | "SR" | "SSR" | "UR";
export const RARITIES: readonly Rarity[] = ["N", "R", "SR", "SSR", "UR"];
export function rarityRank(r: Rarity): number {
  return RARITIES.indexOf(r);
}

export interface RarityStats {
  revenueMultiplier: number;
  extraOrders: number;
  orderBonus: number;
  /** 移動速度（論理px/秒） */
  speed: number;
}

/** ホストのレア度基礎値。要件定義書 §4.1 */
export const HOST_RARITY: Record<Rarity, RarityStats> = {
  N: { revenueMultiplier: 1.0, extraOrders: 1, orderBonus: 0, speed: 80 },
  R: { revenueMultiplier: 1.5, extraOrders: 2, orderBonus: 1, speed: 96 },
  SR: { revenueMultiplier: 2.5, extraOrders: 3, orderBonus: 2, speed: 112 },
  SSR: { revenueMultiplier: 5.0, extraOrders: 4, orderBonus: 3, speed: 128 },
  UR: { revenueMultiplier: 12.0, extraOrders: 6, orderBonus: 4, speed: 160 },
};

/** ホストが着いているときの基本の我慢ゲージ減少倍率 */
export const HOST_PATIENCE_DRAIN = 0.5;

/** ガチャ。要件定義書 §4.2 / §4.4 / §4.5 */
export const GACHA = {
  /** 天井: この連数で「その店舗の最高レア度（UR除く）」以上が確定 */
  pity: 50,
  limitBreakMax: 5,
  /** 限界突破1段階ごとの売上倍率ボーナス（加算） */
  limitBreakBonus: 0.1,
  /**
   * 店舗レベル別の排出率（%）。UR は全店舗で排出、店舗が進むほど上がる。
   * SR は店舗2から、SSR は店舗3から。
   */
  rates: {
    1: { N: 74.99, R: 25, SR: 0, SSR: 0, UR: 0.01 },
    2: { N: 64.95, R: 28, SR: 7, SSR: 0, UR: 0.05 },
    3: { N: 60.9, R: 28, SR: 9.5, SSR: 1.5, UR: 0.1 },
    4: { N: 60.25, R: 28, SR: 9.5, SSR: 2, UR: 0.25 },
    5: { N: 60, R: 28, SR: 9.5, SSR: 2, UR: 0.5 },
  } as Record<number, Record<Rarity, number>>,
  /** 単発価格 = priceBase × 10^(店舗-1)。10連は 9 回分の価格 */
  priceBase: 10_000,
  multiCount: 10,
  multiPriceCount: 9,
  /** 図鑑: そのレア度を全員揃えると全売上に加算されるボーナス */
  collectionBonus: { N: 0.05, R: 0.1, SR: 0.15, SSR: 0.2, UR: 0.3 } as Record<Rarity, number>,
  /** 神（UR）が1人でも出勤していると: 店全体の売上 +30%、来店間隔 ×0.8 */
  godRevenueBonus: 0.3,
  godSpawnFactor: 0.8,
} as const;

export function gachaRates(shopLevel: number): Record<Rarity, number> {
  const lv = Math.max(1, Math.min(5, shopLevel));
  const r = GACHA.rates[lv];
  if (!r) throw new Error(`排出率が未定義: 店舗${lv}`);
  return r;
}

/** 天井で確定するレア度（その店舗で出る UR 以外の最高レア度） */
export function pityRarity(shopLevel: number): Rarity {
  const r = gachaRates(shopLevel);
  if (r.SSR > 0) return "SSR";
  if (r.SR > 0) return "SR";
  return "R";
}

export function gachaPrice(shopLevel: number, multi: boolean): number {
  const single = GACHA.priceBase * Math.pow(10, Math.max(0, shopLevel - 1));
  return multi ? single * GACHA.multiPriceCount : single;
}

export const SAVE = {
  key: "hct-save",
  version: 5,
  autosaveInterval: 30,
} as const;
