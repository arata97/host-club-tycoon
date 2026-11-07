/**
 * 種族パッシブ。要件定義書 §4.3。
 * ホストは酒を運ばず卓で接客するので、効果はすべて「着いている卓」に効く（神のみ店全体）。
 */
export type Race = "人間" | "エルフ" | "ドワーフ" | "獣人" | "魔族" | "ドラゴン" | "神";

export interface RacePassive {
  /** 卓の売上倍率への加算（0.15 = +15%） */
  revenueBonus: number;
  /** おかわり杯数への加算 */
  extraOrders: number;
  /** 注文グレード補正への加算 */
  orderBonus: number;
  /** 我慢ゲージ減少への係数（小さいほど客が帰りにくい） */
  patienceFactor: number;
  /** 移動速度への係数 */
  speedFactor: number;
  description: string;
}

export const RACES: Record<Race, RacePassive> = {
  人間: {
    revenueBonus: 0,
    extraOrders: 0,
    orderBonus: 0,
    patienceFactor: 1,
    speedFactor: 1,
    description: "クセがなく安定（補正なし）",
  },
  エルフ: {
    revenueBonus: 0,
    extraOrders: 0,
    orderBonus: 0,
    patienceFactor: 1,
    speedFactor: 1.2,
    description: "身軽で卓への移動が速い（速度+20%）",
  },
  ドワーフ: {
    revenueBonus: 0,
    extraOrders: 1,
    orderBonus: 0,
    patienceFactor: 1,
    speedFactor: 0.9,
    description: "酒豪。客のおかわり+1杯（速度−10%）",
  },
  獣人: {
    revenueBonus: 0,
    extraOrders: 0,
    orderBonus: 0,
    patienceFactor: 0.6,
    speedFactor: 1,
    description: "人懐っこく客が帰りにくい（待ち時間の減り−40%）",
  },
  魔族: {
    revenueBonus: 0.15,
    extraOrders: 0,
    orderBonus: 0,
    patienceFactor: 1.3,
    speedFactor: 1,
    description: "売上+15%。ただし客を待たせると帰りやすい",
  },
  ドラゴン: {
    revenueBonus: 0.1,
    extraOrders: 0,
    orderBonus: 1,
    patienceFactor: 1,
    speedFactor: 1.1,
    description: "高級酒を勧める（注文グレード+1、売上+10%）",
  },
  神: {
    revenueBonus: 0,
    extraOrders: 0,
    orderBonus: 0,
    patienceFactor: 0.5,
    speedFactor: 1,
    description: "出勤中は店全体の売上+30%、客の来店間隔−20%",
  },
};
