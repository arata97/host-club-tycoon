import type { Grade } from "../game/data/products";
import type { Rarity } from "../game/data/balance";

/**
 * 配色の定義。グラフィック差し替え時はこのファイルと src/render/ 配下だけを触る想定。
 */

export interface PersonPalette {
  suit: string;
  shirt: string;
  skin: string;
  hair: string;
}

export const GRADE_COLOR: Record<Grade, string> = {
  1: "#8fd3ff",
  2: "#c77dff",
  3: "#ffd166",
  4: "#ff6b9d",
};

export const RARITY_COLOR: Record<Rarity, string> = {
  N: "#c9bfdc",
  R: "#8fd3ff",
  SR: "#c77dff",
  SSR: "#ffd166",
  UR: "#ff6b9d",
};

export const PLAYER_PALETTE: PersonPalette = { suit: "#1c1826", shirt: "#f4f0ff", skin: "#f1c9a5", hair: "#d9a441" };
export const STAFF_PALETTE: PersonPalette = { suit: "#141020", shirt: "#e8e8f0", skin: "#f1c9a5", hair: "#2a2a2a" };
export const VIP_PALETTE: PersonPalette = { suit: "#f6c453", shirt: "#fff8dc", skin: "#f1c9a5", hair: "#ffffff" };

export const CUSTOMER_PALETTES: readonly PersonPalette[] = [
  { suit: "#c94f7c", shirt: "#ffe3ec", skin: "#f1c9a5", hair: "#3b2a1e" },
  { suit: "#3f7fbf", shirt: "#e8f3ff", skin: "#e8b48c", hair: "#1c1826" },
  { suit: "#4f9f6f", shirt: "#eafff0", skin: "#f7d6b8", hair: "#8a4b2a" },
  { suit: "#9f6fd0", shirt: "#f3eaff", skin: "#f1c9a5", hair: "#e0c060" },
  { suit: "#d08a3f", shirt: "#fff4e3", skin: "#c98f63", hair: "#2a2a2a" },
];

export const ROOM = {
  wall: "#2a1f3d",
  wallTrim: "#3d2b55",
  floorA: "#5a1f33",
  floorB: "#4d1a2b",
  light: "#f6c453",
  lightGlow: "rgba(246,196,83,0.15)",
  entrance: "#1a1320",
  label: "#8a7fa0",
  bench: "#3a2a4f",
} as const;

export const UI_TEXT = {
  gold: "#f6c453",
  vipGold: "#ffd166",
  info: "#8fd3ff",
  danger: "#ff6b6b",
  pink: "#ff8fb3",
  cream: "#f4e7c3",
} as const;
