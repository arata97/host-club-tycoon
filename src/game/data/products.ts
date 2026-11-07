/** 商品（酒）。要件定義書 §3.2 の単価表。 */
export type Grade = 1 | 2 | 3 | 4;

export interface Product {
  name: string;
  grade: Grade;
  price: number;
}

export const PRODUCTS: readonly Product[] = [
  // グレード1（初期）
  { name: "妖精酒場の日替わりカクテル", grade: 1, price: 1_000 },
  { name: "淡麗のエルフビール", grade: 1, price: 2_025 },
  { name: "スライムサワー", grade: 1, price: 2_025 },
  { name: "氷結晶サワー", grade: 1, price: 2_700 },
  { name: "テキーラ・ローズウィッチ", grade: 1, price: 2_700 },
  { name: "雷鳴のコカボム", grade: 1, price: 4_050 },
  // グレード2（酒蔵Lv3）
  { name: "チャムシルの果実酒", grade: 2, price: 5_000 },
  { name: "鏡の月", grade: 2, price: 10_000 },
  { name: "双月ワイン", grade: 2, price: 10_000 },
  { name: "黒霧の島の芋焼酎", grade: 2, price: 14_000 },
  { name: "茉莉の花精のジャスミン焼酎", grade: 2, price: 15_000 },
  { name: "鍛冶譚の紫蘇焼酎", grade: 2, price: 20_000 },
  { name: "柚子の小魔女", grade: 2, price: 21_000 },
  { name: "一角獣の角瓶", grade: 2, price: 21_000 },
  { name: "神々の河の麦焼酎", grade: 2, price: 28_000 },
  { name: "百年の孤竜", grade: 2, price: 140_000 },
  // グレード3（酒蔵Lv6）
  { name: "リステルの林檎星", grade: 3, price: 30_000 },
  { name: "アスティアの祝泡", grade: 3, price: 40_000 },
  { name: "アンジュエル〈白翼〉", grade: 3, price: 50_000 },
  { name: "アンジュエル〈薔薇翼〉", grade: 3, price: 60_000 },
  { name: "ブーケ・ド・オーロラ", grade: 3, price: 70_000 },
  { name: "モエ・エ・ダンジョン", grade: 3, price: 98_000 },
  { name: "モエ・エ・ダンジョン ロゼ", grade: 3, price: 112_000 },
  { name: "モエ・エ・ダンジョン 氷帝の冠", grade: 3, price: 140_000 },
  { name: "ドン・フェニオン", grade: 3, price: 420_000 },
  { name: "ベル・エルポック", grade: 3, price: 560_000 },
  { name: "アルマドラ〈黄金竜〉", grade: 3, price: 700_000 },
  { name: "ドン・フェニオン 不死鳥のロゼ", grade: 3, price: 840_000 },
  // グレード4（高級店以降）
  { name: "アルマドラ〈薔薇竜〉", grade: 4, price: 1_000_000 },
  { name: "エンジェル・ドゥミセラフ ロゼ", grade: 4, price: 1_200_000 },
  { name: "アルマドラ〈翠玉竜〉", grade: 4, price: 1_300_000 },
  { name: "アルマドラ〈白銀竜〉", grade: 4, price: 1_500_000 },
  { name: "エンジェル・ドゥミセラフ 白金の古酒", grade: 4, price: 2_500_000 },
  { name: "天帝の秘蔵酒〈インペリアル・エッグ〉", grade: 4, price: 3_000_000 },
  { name: "ヘネシエルの失楽園〈皇帝蔵〉", grade: 4, price: 3_500_000 },
  { name: "ドン・フェニオン 失われた修道院", grade: 4, price: 4_200_000 },
  { name: "竜王ルイ十三世", grade: 4, price: 8_400_000 },
  { name: "世界樹のシャンパンタワー", grade: 4, price: 10_000_000 },
];

/** 酒蔵Lvで提供できる上限グレード。グレード4は店舗3以降（フェーズ3で解放）。 */
export function maxGradeForCellar(level: number): Grade {
  if (level >= 6) return 3;
  if (level >= 3) return 2;
  return 1;
}

export function productsUpTo(grade: Grade): Product[] {
  return PRODUCTS.filter((p) => p.grade <= grade);
}

function pick<T>(arr: readonly T[]): T {
  const v = arr[Math.floor(Math.random() * arr.length)];
  if (v === undefined) throw new Error("空の配列から選択しようとしました");
  return v;
}

/**
 * 客の注文を決める。
 * - 通常客: 提供可能グレードから、低グレードほど出やすい重み付きで選ぶ
 * - VIP: 最高グレードの中からランダム
 * - orderBonus: 着いているホストの格（0〜4）。大きいほど高グレードに寄る
 */
export function rollOrder(maxGrade: Grade, vip: boolean, orderBonus = 0): Product {
  if (vip) return pick(PRODUCTS.filter((p) => p.grade === maxGrade));
  // グレード g の重み = (maxGrade - g + 1) + orderBonus × g
  const weights: number[] = [];
  for (let g = 1; g <= maxGrade; g++) weights.push(maxGrade - g + 1 + orderBonus * g);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let grade: Grade = 1;
  for (let g = 1; g <= maxGrade; g++) {
    r -= weights[g - 1] ?? 0;
    if (r <= 0) {
      grade = g as Grade;
      break;
    }
  }
  return pick(PRODUCTS.filter((p) => p.grade === grade));
}
