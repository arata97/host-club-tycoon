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
  table: { base: 5_000, growth: 1.8, max: 8 } satisfies UpgradeDef,
  /** 酒蔵Lv（初期Lv1）。Lv3でグレード2、Lv6でグレード3が解放 */
  cellar: { base: 8_000, growth: 2.0, max: 10 } satisfies UpgradeDef,
  /** 主人公の移動速度 +10%/Lv */
  speed: { base: 3_000, growth: 1.7, max: 10 } satisfies UpgradeDef,
  /** 主人公の運搬数 +1/Lv（初期2） */
  carry: { base: 4_000, growth: 1.7, max: 8 } satisfies UpgradeDef,
  /** ホスト雇用（フェーズ1は固定ステータスのN相当） */
  host: { base: 20_000, growth: 1.6, max: 6 } satisfies UpgradeDef,
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
  /** 注文を待てる時間（秒）。超えると帰る */
  patience: 30,
  /** 飲んでいる時間（秒） */
  drinkTime: 4,
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

export const PLAYER = {
  speedBase: 90,
  speedPerLevel: 0.1,
  carryBase: 2,
  /** 回収・提供が発生する距離（論理px） */
  interactRadius: 26,
  serveInterval: 0.3,
} as const;

export const HOST = {
  speed: 70,
  carry: 2,
  /** 収益倍率（N相当） */
  revenueMultiplier: 1.0,
} as const;

export const SAVE = {
  key: "hct-save",
  version: 1,
  autosaveInterval: 30,
} as const;
