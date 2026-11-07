/**
 * 種族パッシブ。要件定義書 §4.3。
 * 異世界設定のため「人間」は存在しない。
 * ホストは酒を運ばず卓で接客するので、効果はすべて「着いている卓」に効く（神のみ店全体）。
 */
export type Race = "エルフ" | "獣人" | "鬼人" | "吸血鬼" | "妖精" | "ドラゴン" | "神";
export const RACE_LIST: readonly Race[] = ["エルフ", "獣人", "鬼人", "吸血鬼", "妖精", "ドラゴン", "神"];

export interface RacePassive {
  /** 卓の売上倍率への加算（0.15 = +15%） */
  revenueBonus: number;
  /** 23:00 以降の売上倍率への加算 */
  lateRevenueBonus: number;
  /** 注文グレード補正への加算 */
  orderBonus: number;
  /** 我慢ゲージ減少への係数（小さいほど客が帰りにくい） */
  patienceFactor: number;
  /** 移動速度への係数 */
  speedFactor: number;
  /** 太客化の確率への係数 */
  regularFactor: number;
  /** スタミナ消費への係数 */
  staminaDrainFactor: number;
  /** スタミナ回復への係数 */
  staminaRegenFactor: number;
  description: string;
}

const BASE: Omit<RacePassive, "description"> = {
  revenueBonus: 0,
  lateRevenueBonus: 0,
  orderBonus: 0,
  patienceFactor: 1,
  speedFactor: 1,
  regularFactor: 1,
  staminaDrainFactor: 1,
  staminaRegenFactor: 1,
};

export const RACES: Record<Race, RacePassive> = {
  エルフ: { ...BASE, speedFactor: 1.2, description: "身軽で卓への移動が速い（速度+20%）" },
  獣人: { ...BASE, patienceFactor: 0.6, description: "人懐っこく客が帰りにくい（待ち時間の減り−40%）" },
  鬼人: { ...BASE, regularFactor: 2, description: "義理堅く客を大事にする（太客になる確率×2）" },
  吸血鬼: { ...BASE, lateRevenueBonus: 0.3, description: "夜に強い（23時以降の売上+30%）" },
  妖精: {
    ...BASE,
    staminaDrainFactor: 0.6,
    staminaRegenFactor: 1.5,
    description: "疲れにくい（スタミナ消費−40%、回復+50%）",
  },
  ドラゴン: {
    ...BASE,
    revenueBonus: 0.1,
    orderBonus: 1,
    speedFactor: 1.1,
    description: "高級酒を勧める（注文グレード+1、売上+10%）",
  },
  神: { ...BASE, patienceFactor: 0.5, description: "出勤中は店全体の売上+30%、客の来店間隔−20%" },
};
