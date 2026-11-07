import type { Race } from "./races";

/**
 * 客のタイプと時間帯。要件定義書 §10.1 / §10.6。
 * 数値はすべて仮（フェーズ3e で調整）。
 */
export type CustomerType = "冒険者" | "商人" | "貴族" | "魔導士" | "王族";
export const CUSTOMER_TYPES: readonly CustomerType[] = ["冒険者", "商人", "貴族", "魔導士", "王族"];

/** 時間帯。20:00〜21:00 / 21:00〜23:00 / 23:00〜24:00 */
export type TimeBand = "early" | "mid" | "late";

export interface CustomerTypeDef {
  /** 1文字の表示用ラベル（頭上に出す） */
  short: string;
  /** 相性の良い種族（売上 +30%・指名されやすい） */
  likes: readonly Race[];
  /** 苦手な種族（売上 −20%） */
  dislikes: Race | null;
  /** 予算（杯数換算）。来店時の提供可能グレードの平均単価 × この杯数 */
  budgetDrinks: readonly [number, number];
  /** 時間帯別の出現重み */
  weight: Record<TimeBand, number>;
  /** 太客の呼び名（名前生成用） */
  honorific: string;
}

export const CUSTOMER_TYPE_DEFS: Record<CustomerType, CustomerTypeDef> = {
  冒険者: {
    short: "冒",
    likes: ["獣人", "鬼人"],
    dislikes: "吸血鬼",
    budgetDrinks: [2, 4],
    weight: { early: 5, mid: 3, late: 1 },
    honorific: "旅の",
  },
  商人: {
    short: "商",
    likes: ["鬼人", "妖精"],
    dislikes: "エルフ",
    budgetDrinks: [3, 5],
    weight: { early: 3, mid: 4, late: 2 },
    honorific: "豪商",
  },
  貴族: {
    short: "貴",
    likes: ["エルフ", "吸血鬼"],
    dislikes: "獣人",
    budgetDrinks: [4, 7],
    weight: { early: 1, mid: 3, late: 4 },
    honorific: "令嬢",
  },
  魔導士: {
    short: "魔",
    likes: ["妖精", "吸血鬼"],
    dislikes: "鬼人",
    budgetDrinks: [3, 6],
    weight: { early: 1, mid: 3, late: 3 },
    honorific: "賢者",
  },
  王族: {
    short: "王",
    likes: ["ドラゴン", "神"],
    dislikes: null,
    budgetDrinks: [8, 12],
    weight: { early: 0, mid: 1, late: 3 },
    honorific: "姫",
  },
};

export interface TimeBandDef {
  /** 予算の係数 */
  budgetFactor: number;
  vipChance: number;
  /** 来店間隔の係数（小さいほど混む） */
  spawnFactor: number;
}

export const TIME_BANDS: Record<TimeBand, TimeBandDef> = {
  early: { budgetFactor: 0.8, vipChance: 0.02, spawnFactor: 1.0 },
  mid: { budgetFactor: 1.0, vipChance: 0.05, spawnFactor: 0.9 },
  late: { budgetFactor: 1.3, vipChance: 0.1, spawnFactor: 0.8 },
};

export function timeBandOf(clockMin: number): TimeBand {
  if (clockMin < 60) return "early";
  if (clockMin < 180) return "mid";
  return "late";
}

/** 相性: 1.3（好み）／ 0.8（苦手）／ 1.0 */
export function affinityMultiplier(type: CustomerType, race: Race): number {
  const def = CUSTOMER_TYPE_DEFS[type];
  if (def.likes.includes(race)) return 1.3;
  if (def.dislikes === race) return 0.8;
  return 1;
}

/** 太客・指名まわり */
export const REGULAR = {
  /** 1ホストあたりの太客の上限 */
  maxPerHost: 5,
  /** 満足して帰った一見客が太客になる確率（相性の良いホストに着かれていた場合） */
  convertChance: 0.25,
  /** 太客になる条件: この杯数以上飲んだ */
  convertMinDrinks: 2,
  /** 来店時に太客が選ばれる確率 = min(cap, 人数 × perRegular) */
  visitChancePerRegular: 0.08,
  visitChanceCap: 0.5,
  /** 指名ホストが着いたときの売上倍率 */
  nominationMultiplier: 1.5,
  /** 指名客に誰も着いていないときの我慢ゲージ減少倍率 */
  unattendedDrain: 2,
  /** 指名客は、指名ホストが忙しければこの時間（分）まで待つ（それを過ぎると他のホストが着く） */
  waitForNominatedMin: 15,
  /** 好感度の増減 */
  affinityGainVisit: 10,
  affinityLossAngry: 15,
  affinityLossNoHost: 10,
  /** 好感度による予算係数: 1 + affinity/100 × this */
  budgetPerAffinity: 0.5,
  initialAffinity: 50,
} as const;

const FIRST_NAMES = ["アリア", "ベル", "セレナ", "ミラ", "ルナ", "ノエル", "リリィ", "エマ", "ソフィ", "クロエ", "ユリア", "ニナ"];

/** 太客の名前を作る。例: 「令嬢セレナ」 */
export function regularName(type: CustomerType, seed: number): string {
  const first = FIRST_NAMES[seed % FIRST_NAMES.length] ?? "アリア";
  return `${CUSTOMER_TYPE_DEFS[type].honorific}${first}`;
}

/** ホストのスタミナ（§10.7） */
export const STAMINA = {
  max: 100,
  /** 接客中の減少（/分） */
  drainServing: 1,
  /** 待機席での回復（/分） */
  regenIdle: 0.5,
  /** 開店時の回復: 出勤者／控え */
  recoverOnFloor: 30,
  recoverBench: 60,
  /** これ未満だと卓に着けない */
  minToServe: 10,
  /** 接客効果の係数 = floor + (1 − floor) × スタミナ/100 */
  effectFloor: 0.5,
} as const;

/** つけ回し方針（§10.8） */
export type AssignPolicy = "affinity" | "nomination" | "rotation" | "ace";
export const ASSIGN_POLICIES: ReadonlyArray<{ key: AssignPolicy; label: string; desc: string }> = [
  { key: "affinity", label: "相性優先", desc: "客のタイプと相性の良いホストを優先して着ける" },
  { key: "nomination", label: "指名優先", desc: "指名客は指名ホストが空くまで最大15分待たせてでも着ける。一見客は手の空いた者" },
  { key: "rotation", label: "均等ローテ", desc: "スタミナが多い順に回す。疲れにくいが相性は見ない" },
  { key: "ace", label: "エース集中", desc: "レア度の高い順に着ける。高単価を狙えるがエースが疲れる" },
];
