import { CUSTOMER } from "../game/data/balance";
import { CUSTOMER_TYPE_DEFS, STAMINA } from "../game/data/customers";
import type { Race } from "../game/data/races";
import type { Customer } from "../game/entities/customer";
import type { Host } from "../game/entities/host";
import type { Staff } from "../game/entities/staff";
import type { Player } from "../game/player";
import {
  CUSTOMER_PALETTES,
  GRADE_COLOR,
  PLAYER_PALETTE,
  RARITY_COLOR,
  STAFF_PALETTE,
  UI_TEXT,
  VIP_PALETTE,
} from "./palette";
import { drawCarriedBottles, drawCreature, drawCrown, drawHeart, drawNameTag, drawPerson, type RaceFeature } from "./people";

export const RACE_FEATURE: Record<Race, RaceFeature> = {
  エルフ: "elfEars",
  獣人: "beastEars",
  鬼人: "horns",
  吸血鬼: "vampire",
  妖精: "wings",
  ドラゴン: "dragonHorns",
  神: "none",
};

/** 客の見た目（人間に見えないよう、必ずどれかの特徴を付ける） */
const CUSTOMER_FEATURES: readonly RaceFeature[] = ["elfEars", "beastEars", "horns", "wings", "dragonHorns"];

export function drawPlayer(ctx: CanvasRenderingContext2D, p: Player): void {
  drawPerson(ctx, p.x, p.y, PLAYER_PALETTE, p.walkT, p.facing);
  drawCarriedBottles(ctx, p.x, p.y, p.carrying);
}

export function drawStaff(ctx: CanvasRenderingContext2D, s: Staff): void {
  // 内勤（黒服）はエルフ
  drawCreature(ctx, s.x, s.y, STAFF_PALETTE, s.walkT, s.facing, "elfEars");
  drawCarriedBottles(ctx, s.x, s.y, s.carrying);
  ctx.fillStyle = "#c94f7c";
  ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 10, 2, 1);
  drawNameTag(ctx, s.x, s.y, s.name, "rgba(200,200,220,0.75)");
}

export function drawHost(ctx: CanvasRenderingContext2D, h: Host): void {
  const px = Math.round(h.x);
  const py = Math.round(h.y);
  const rarity = h.def.rarity;

  if (rarity === "UR") {
    const pulse = 0.35 + 0.2 * Math.sin(h.animT * 3);
    ctx.fillStyle = `rgba(255,209,102,${pulse.toFixed(2)})`;
    ctx.fillRect(px - 7, py - 21, 14, 2);
    ctx.fillRect(px - 8, py - 19, 2, 12);
    ctx.fillRect(px + 6, py - 19, 2, 12);
  }

  drawCreature(ctx, h.x, h.y, h.def.palette, h.walkT, h.facing, RACE_FEATURE[h.def.race]);

  if (h.phase === "serving") {
    const bob = Math.round(Math.sin(h.animT * 4) * 2);
    ctx.font = "bold 8px monospace";
    ctx.fillStyle = UI_TEXT.pink;
    ctx.fillText("♪", px - 10, py - 22 + bob);
  }

  const lb = h.limitBreak > 0 ? `+${h.limitBreak}` : "";
  drawNameTag(ctx, h.x, h.y, `${h.def.name}${lb}`, RARITY_COLOR[rarity]);

  // スタミナバー
  const ratio = Math.max(0, Math.min(1, h.stamina / STAMINA.max));
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(px - 6, py + 11, 12, 2);
  ctx.fillStyle = ratio > 0.5 ? "#7bd88f" : ratio > 0.2 ? UI_TEXT.gold : UI_TEXT.danger;
  ctx.fillRect(px - 6, py + 11, Math.max(1, Math.round(12 * ratio)), 2);
  if (h.stamina < STAMINA.minToServe) {
    ctx.font = "bold 6px monospace";
    ctx.fillStyle = UI_TEXT.danger;
    ctx.fillText("zz", px + 5, py - 18);
  }
}

export function drawCustomer(ctx: CanvasRenderingContext2D, c: Customer): void {
  const palette = c.vip ? VIP_PALETTE : (CUSTOMER_PALETTES[c.look % CUSTOMER_PALETTES.length] ?? VIP_PALETTE);
  const feature = CUSTOMER_FEATURES[Math.floor(c.look / 7) % CUSTOMER_FEATURES.length] ?? "elfEars";
  const walking = c.phase === "walking" || c.phase === "leaving";
  drawCreature(ctx, c.x, c.y, palette, walking ? c.walkT : 0, c.facing, feature);
  const px = Math.round(c.x);
  const py = Math.round(c.y);

  if (c.vip) drawCrown(ctx, px, py, UI_TEXT.gold);

  if (c.phase === "waiting") {
    const bx = px + 8;
    const by = py - 30;
    ctx.fillStyle = "#fffaf0";
    ctx.fillRect(bx, by, 14, 12);
    ctx.fillRect(bx + 2, by + 12, 3, 2);
    ctx.fillStyle = "#2b6f8f";
    ctx.fillRect(bx + 5, by + 4, 4, 6);
    ctx.fillStyle = GRADE_COLOR[c.order.grade];
    ctx.fillRect(bx + 6, by + 2, 2, 3);
    if (c.drinksHad > 0) {
      ctx.font = "bold 6px monospace";
      ctx.fillStyle = "#c94f7c";
      ctx.fillText("+", bx + 10, by + 5);
    }
    const ratio = Math.max(0, c.patience / CUSTOMER.patience);
    ctx.fillStyle = "#333";
    ctx.fillRect(bx, by + 15, 14, 2);
    ctx.fillStyle = ratio > 0.4 ? "#7bd88f" : ratio > 0.2 ? UI_TEXT.gold : UI_TEXT.danger;
    ctx.fillRect(bx, by + 15, Math.round(14 * ratio), 2);
  } else if (c.phase === "drinking") {
    ctx.fillStyle = GRADE_COLOR[c.order.grade];
    ctx.fillRect(px - 7, py - 10, 2, 3);
    ctx.fillStyle = "#fffaf0";
    ctx.fillRect(px - 7, py - 7, 2, 1);
  } else if (c.phase === "leaving" && c.angry) {
    ctx.font = "bold 8px monospace";
    ctx.fillStyle = UI_TEXT.danger;
    ctx.fillText("!", px + 6, py - 20);
  }

  if (c.hostedByPlayer && (c.phase === "waiting" || c.phase === "drinking")) {
    drawHeart(ctx, px - 12, py - 24, UI_TEXT.pink);
  }

  // 足元: 太客は名前（ピンク）、一見客はタイプ
  if (c.phase !== "leaving") {
    if (c.regular) drawNameTag(ctx, c.x, c.y, `${c.dohan ? "同伴" : ""}♥${c.regular.name}`, UI_TEXT.pink);
    else drawNameTag(ctx, c.x, c.y, CUSTOMER_TYPE_DEFS[c.type].short, "rgba(220,210,240,0.7)");
  }
}

/** 主人公の頭上に出す操作ヒント */
export function drawPrompt(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
  const px = Math.round(x);
  const py = Math.round(y) - 32;
  ctx.font = "bold 7px monospace";
  const w = Math.ceil(ctx.measureText(text).width) + 6;
  ctx.fillStyle = "rgba(14,9,24,0.85)";
  ctx.fillRect(px - Math.floor(w / 2), py - 7, w, 10);
  ctx.fillStyle = UI_TEXT.gold;
  ctx.textAlign = "center";
  ctx.fillText(text, px, py);
  ctx.textAlign = "left";
}
