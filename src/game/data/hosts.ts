import type { PersonPalette } from "../../render/palette";
import type { Rarity } from "./balance";
import type { Race } from "./races";

export interface HostDef {
  /** セーブに使う安定ID */
  id: string;
  name: string;
  rarity: Rarity;
  race: Race;
  /** ガチャのプールに入る店舗レベル。UR は店舗1から（超低確率） */
  unlockShop: number;
  palette: PersonPalette;
  profile: string;
}

const SKIN = "#f1c9a5";
const SUIT: Record<Rarity, string> = {
  N: "#1c1826",
  R: "#1f2a4a",
  SR: "#3a1f4a",
  SSR: "#4a1f2a",
  UR: "#e8e4f4",
};

/**
 * ホスト名簿（20人）。要件定義書 §4.3。
 * 神（UR）以外の源氏名は仮称。後から差し替え可（id は変えないこと）。
 */
export const HOST_ROSTER: readonly HostDef[] = [
  // ---- 店舗1 ----
  { id: "ren", name: "蓮", rarity: "N", race: "鬼人", unlockShop: 1, palette: { suit: SUIT.N, shirt: "#f4f0ff", skin: "#f0c0a8", hair: "#2a2a2a" }, profile: "転生前も新人ホストだった、真面目な鬼人。小さな角がコンプレックス。" },
  { id: "kakeru", name: "翔", rarity: "N", race: "鬼人", unlockShop: 1, palette: { suit: SUIT.N, shirt: "#f4f0ff", skin: "#e8b48c", hair: "#6b3a1e" }, profile: "盛り上げ担当。コールの声だけは店一番。" },
  { id: "yuu", name: "ユウ", rarity: "N", race: "獣人", unlockShop: 1, palette: { suit: SUIT.N, shirt: "#fff4e3", skin: "#f7d6b8", hair: "#c98f63" }, profile: "犬系獣人。尻尾で感情がバレる。" },
  { id: "garon", name: "ガロン", rarity: "N", race: "鬼人", unlockShop: 1, palette: { suit: "#3a2a1e", shirt: "#f4f0ff", skin: "#d8a080", hair: "#a0522d" }, profile: "大柄な鬼人。樽ごと飲める。客もつられて飲む。" },
  { id: "rio", name: "リオ", rarity: "R", race: "エルフ", unlockShop: 1, palette: { suit: SUIT.R, shirt: "#eafff0", skin: "#f7e0c8", hair: "#e8e0a0" }, profile: "森から出てきたばかりの天然エルフ。" },
  { id: "rui", name: "瑠衣", rarity: "R", race: "妖精", unlockShop: 1, palette: { suit: SUIT.R, shirt: "#f3eaff", skin: "#f7e8f0", hair: "#8fa0ff" }, profile: "聞き上手な妖精。気づけば客が身の上話をしている。" },
  // ---- 店舗2 ----
  { id: "kaito", name: "海斗", rarity: "N", race: "妖精", unlockShop: 2, palette: { suit: SUIT.N, shirt: "#e8f3ff", skin: "#f0e8f0", hair: "#3b8aab" }, profile: "港町の海の妖精。笑顔が爽やか。" },
  { id: "kotarou", name: "コタロウ", rarity: "N", race: "獣人", unlockShop: 2, palette: { suit: SUIT.N, shirt: "#fff4e3", skin: "#f7d6b8", hair: "#e0a040" }, profile: "狐系獣人。人を化かすのが得意。" },
  { id: "doran", name: "ドラン", rarity: "N", race: "妖精", unlockShop: 2, palette: { suit: "#3a2a1e", shirt: "#f4f0ff", skin: "#f0e0d0", hair: "#7a3a1a" }, profile: "酒樽に宿っていた妖精。酒の目利きは確か。" },
  { id: "noa", name: "ノア", rarity: "R", race: "エルフ", unlockShop: 2, palette: { suit: SUIT.R, shirt: "#eafff0", skin: "#f7e0c8", hair: "#c0f0d0" }, profile: "300歳の年下キャラ。" },
  { id: "rei", name: "零", rarity: "R", race: "吸血鬼", unlockShop: 2, palette: { suit: SUIT.R, shirt: "#f0e8ff", skin: "#e8e0f0", hair: "#303050" }, profile: "クールな吸血鬼。笑うと牙がのぞき、客が落ちる。" },
  { id: "shion", name: "紫苑", rarity: "SR", race: "吸血鬼", unlockShop: 2, palette: { suit: SUIT.SR, shirt: "#f0e8ff", skin: "#f0e8f4", hair: "#a060d0" }, profile: "吸血鬼の元貴族。所作がいちいち優雅。" },
  // ---- 店舗3 ----
  { id: "kouga", name: "皇牙", rarity: "R", race: "獣人", unlockShop: 3, palette: { suit: SUIT.R, shirt: "#fff4e3", skin: "#f7d6b8", hair: "#f0f0f0" }, profile: "白狼の獣人。忠誠心が強すぎる。" },
  { id: "alvin", name: "アルヴィン", rarity: "SR", race: "エルフ", unlockShop: 3, palette: { suit: SUIT.SR, shirt: "#eafff0", skin: "#f7e0c8", hair: "#f0e8c0" }, profile: "エルフの王子。お忍びで働いている。" },
  { id: "ibuki", name: "一颯", rarity: "SR", race: "鬼人", unlockShop: 3, palette: { suit: SUIT.SR, shirt: "#ffe3ec", skin: "#f0c0a8", hair: "#d04040" }, profile: "元・勇者パーティの鬼人剣士。今は剣より口。" },
  { id: "vald", name: "ヴァルド", rarity: "SSR", race: "ドラゴン", unlockShop: 3, palette: { suit: SUIT.SSR, shirt: "#ffd166", skin: "#f0c8a0", hair: "#c03030" }, profile: "人の姿をとった紅竜。財宝より客の笑顔を集める。" },
  // ---- 店舗4 ----
  { id: "meiya", name: "冥夜", rarity: "SR", race: "吸血鬼", unlockShop: 4, palette: { suit: SUIT.SR, shirt: "#e0d8f0", skin: "#e8e0f0", hair: "#101018" }, profile: "夜の王たる吸血鬼。指名すると帰れなくなる、らしい。" },
  { id: "ryusei", name: "リュウセイ", rarity: "SSR", race: "ドラゴン", unlockShop: 4, palette: { suit: SUIT.SSR, shirt: "#ffd166", skin: SKIN, hair: "#40a0f0" }, profile: "蒼竜。王都の夜を統べる伝説のホスト。" },
  // ---- シークレット（神） ----
  { id: "rikkun", name: "噂のりっくん", rarity: "UR", race: "神", unlockShop: 1, palette: { suit: SUIT.UR, shirt: "#ffd166", skin: SKIN, hair: "#f6c453" }, profile: "どこからともなく現れる、噂の神。会えたら幸運。" },
  { id: "hassy", name: "はっしー(´･ω･`)", rarity: "UR", race: "神", unlockShop: 1, palette: { suit: SUIT.UR, shirt: "#ff8fb3", skin: SKIN, hair: "#ffffff" }, profile: "「(´･ω･`)」しか言わないのに、なぜか客が離れない神。" },
];

export function hostById(id: string): HostDef | undefined {
  return HOST_ROSTER.find((h) => h.id === id);
}
