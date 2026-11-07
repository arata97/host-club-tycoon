import type { HostDef } from "../entities/host";

/**
 * ホスト名簿。要件定義書 §4.3。
 * フェーズ1.5 ではスカウト（ショップ）で上から順に加入する。フェーズ2でガチャに置き換え。
 */
export const HOST_ROSTER: readonly HostDef[] = [
  { name: "蓮", rarity: "N", race: "人間", palette: { suit: "#1c1826", shirt: "#f4f0ff", skin: "#f1c9a5", hair: "#2a2a2a" } },
  { name: "翔", rarity: "N", race: "人間", palette: { suit: "#2a2440", shirt: "#f4f0ff", skin: "#e8b48c", hair: "#6b3a1e" } },
  { name: "ユウ", rarity: "N", race: "獣人", palette: { suit: "#1c1826", shirt: "#fff4e3", skin: "#f7d6b8", hair: "#c98f63" } },
  { name: "ガロン", rarity: "N", race: "ドワーフ", palette: { suit: "#3a2a1e", shirt: "#f4f0ff", skin: "#e8b48c", hair: "#a0522d" } },
  { name: "リオ", rarity: "R", race: "エルフ", palette: { suit: "#1c1826", shirt: "#eafff0", skin: "#f7e0c8", hair: "#e8e0a0" } },
  { name: "瑠衣", rarity: "R", race: "人間", palette: { suit: "#1c1826", shirt: "#f3eaff", skin: "#f1c9a5", hair: "#8fa0ff" } },
];
