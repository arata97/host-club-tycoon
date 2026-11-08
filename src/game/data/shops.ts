import { type Rarity, rarityRank, UPGRADES, type UpgradeKey } from "./balance";

/**
 * 店舗と席グレード。要件定義書 §5 / §10.10。
 * 店舗は移転式で、営業するのは常に1店舗。数値はすべて仮（フェーズ3e で調整）。
 */

export type SeatGrade = "general" | "vip" | "exe" | "god";
/** 格の低い順 */
export const SEAT_GRADES: readonly SeatGrade[] = ["general", "vip", "exe", "god"];

export interface SeatDef {
  label: string;
  /** 卓の上に出す短い名前 */
  short: string;
  /** 単価の倍率 */
  priceMultiplier: number;
  /** 着けるホストの最低レア度。null なら誰でも */
  minRarity: Rarity | null;
  /** 滞在の延長に効くおかわり杯数の加算 */
  extraOrders: number;
}

export const SEATS: Record<SeatGrade, SeatDef> = {
  general: { label: "一般席", short: "", priceMultiplier: 1, minRarity: null, extraOrders: 0 },
  vip: { label: "VIP席", short: "VIP", priceMultiplier: 2, minRarity: "SR", extraOrders: 0 },
  exe: { label: "EXE VIP席", short: "EXE", priceMultiplier: 5, minRarity: "SSR", extraOrders: 3 },
  god: { label: "神座", short: "神座", priceMultiplier: 10, minRarity: "UR", extraOrders: 3 },
};

/** このレア度のホストがこの席に着けるか */
export function seatAccepts(grade: SeatGrade, rarity: Rarity): boolean {
  const min = SEATS[grade].minRarity;
  return min === null || rarityRank(rarity) >= rarityRank(min);
}

/** 一見客が、空いている上位の席へ案内される確率（VIP・指名客は優先される） */
export const SEAT_WALKIN_CHANCE = 0.35;
/** 神が神座で接客している間の、店全体の売上ボーナス */
export const GOD_THRONE_BONUS = 0.2;

export interface ShopDef {
  level: number;
  name: string;
  /** 解放に必要な累計売上 */
  unlockRevenue: number;
  /** 図鑑コンプ（全20人）が条件か */
  needsFullCollection: boolean;
  /** 移転費用 */
  moveCost: number;
  /** 席の上限 */
  seats: Record<SeatGrade, number>;
  /** この店舗で増える要素の説明 */
  feature: string;
}

export const SHOPS: readonly ShopDef[] = [
  {
    level: 1,
    name: "場末の酒場「はじまりの灯」",
    unlockRevenue: 0,
    needsFullCollection: false,
    moveCost: 0,
    seats: { general: 5, vip: 0, exe: 0, god: 0 },
    feature: "最初の店",
  },
  {
    level: 2,
    name: "街のホストクラブ",
    unlockRevenue: 500_000,
    needsFullCollection: false,
    moveCost: 300_000,
    seats: { general: 6, vip: 2, exe: 0, god: 0 },
    feature: "VIP席／会計が必要になり、レジで内勤に任せられる／SR がガチャに登場",
  },
  {
    level: 3,
    name: "貴族街の高級店",
    unlockRevenue: 5_000_000,
    needsFullCollection: false,
    moveCost: 3_000_000,
    seats: { general: 8, vip: 2, exe: 1, god: 0 },
    feature: "EXE VIP席／シャンパンコール／グレード4の酒／SSR がガチャに登場",
  },
  {
    level: 4,
    name: "王都一番店",
    unlockRevenue: 50_000_000,
    needsFullCollection: false,
    moveCost: 30_000_000,
    seats: { general: 10, vip: 3, exe: 1, god: 0 },
    feature: "月間No.1発表／席の上限が増える",
  },
  {
    level: 5,
    name: "魔王城ラウンジ",
    unlockRevenue: 500_000_000,
    needsFullCollection: false,
    moveCost: 300_000_000,
    seats: { general: 10, vip: 3, exe: 2, god: 1 },
    feature: "神座／送迎馬車／神の排出率が適正に",
  },
  {
    level: 6,
    name: "天界クラブ",
    unlockRevenue: 0,
    needsFullCollection: true,
    moveCost: 1_000_000_000,
    seats: { general: 10, vip: 3, exe: 2, god: 1 },
    feature: "図鑑を完成させた者だけが開ける最後の店",
  },
];

export const MAX_SHOP_LEVEL = SHOPS.length;

export function shopDef(level: number): ShopDef {
  const def = SHOPS[Math.max(1, Math.min(MAX_SHOP_LEVEL, level)) - 1];
  if (!def) throw new Error(`店舗が未定義: ${level}`);
  return def;
}

/** 会計（店舗2以降）: 帰る客は会計が済むまで席を空けない */
export const CHECKOUT = {
  fromShop: 2,
  /** 誰も会計しないときの待ち時間（分） */
  waitMin: 15,
  /** レジ導入後の待ち時間（分） */
  registerMin: 2,
} as const;

/** シャンパンコール（店舗3以降）: 対象のシャンパンが提供されると全卓の売上が上がる */
export const CHAMPAGNE = {
  fromShop: 3,
  durationMin: 30,
  /** 終わってから次のコールが出せるまで（分） */
  cooldownMin: 30,
  multiplier: 1.5,
} as const;

/** 月間No.1発表（店舗4以降） */
export const MONTHLY = {
  fromShop: 4,
  /** 1期間の営業日数 */
  days: 10,
  /** 次の期間、No.1 のホストの売上に掛かるボーナス */
  bonus: 0.2,
} as const;

/** 送迎馬車（店舗5以降）: 1Lvごとに来店間隔 −10% */
export const CARRIAGE = {
  fromShop: 5,
  perLevel: 0.1,
} as const;

/** その店舗で購入できる回数の上限。0 ならまだ買えない */
export function upgradeCap(key: UpgradeKey, shopLevel: number): number {
  const seats = shopDef(shopLevel).seats;
  switch (key) {
    case "table":
      return seats.general - 1;
    case "vip":
      return seats.vip;
    case "exe":
      return seats.exe;
    case "throne":
      return seats.god;
    case "register":
      return shopLevel >= CHECKOUT.fromShop ? UPGRADES.register.max : 0;
    case "carriage":
      return shopLevel >= CARRIAGE.fromShop ? UPGRADES.carriage.max : 0;
    default:
      return UPGRADES[key].max;
  }
}
