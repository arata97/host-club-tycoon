import { CUSTOMER } from "../game/data/balance";
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
import { drawCarriedBottles, drawCrown, drawHeart, drawNameTag, drawPerson } from "./people";

export function drawPlayer(ctx: CanvasRenderingContext2D, p: Player): void {
  drawPerson(ctx, p.x, p.y, PLAYER_PALETTE, p.walkT, p.facing);
  drawCarriedBottles(ctx, p.x, p.y, p.carrying);
}

export function drawStaff(ctx: CanvasRenderingContext2D, s: Staff): void {
  drawPerson(ctx, s.x, s.y, STAFF_PALETTE, s.walkT, s.facing);
  drawCarriedBottles(ctx, s.x, s.y, s.carrying);
  // 蝶ネクタイ
  ctx.fillStyle = "#c94f7c";
  ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 10, 2, 1);
  drawNameTag(ctx, s.x, s.y, s.name, "rgba(200,200,220,0.75)");
}

export function drawHost(ctx: CanvasRenderingContext2D, h: Host): void {
  const px = Math.round(h.x);
  const py = Math.round(h.y);
  const rarity = h.def.rarity;

  // 神（UR）は後光
  if (rarity === "UR") {
    const pulse = 0.35 + 0.2 * Math.sin(h.animT * 3);
    ctx.fillStyle = `rgba(255,209,102,${pulse.toFixed(2)})`;
    ctx.fillRect(px - 7, py - 21, 14, 2);
    ctx.fillRect(px - 8, py - 19, 2, 12);
    ctx.fillRect(px + 6, py - 19, 2, 12);
  }

  drawPerson(ctx, h.x, h.y, h.def.palette, h.walkT, h.facing);

  if (h.phase === "serving") {
    const bob = Math.round(Math.sin(h.animT * 4) * 2);
    ctx.font = "bold 8px monospace";
    ctx.fillStyle = UI_TEXT.pink;
    ctx.fillText("♪", px - 10, py - 22 + bob);
  }

  const lb = h.limitBreak > 0 ? `+${h.limitBreak}` : "";
  drawNameTag(ctx, h.x, h.y, `${h.def.name}${lb}`, RARITY_COLOR[rarity]);
}

export function drawCustomer(ctx: CanvasRenderingContext2D, c: Customer): void {
  const palette = c.vip ? VIP_PALETTE : (CUSTOMER_PALETTES[c.look % CUSTOMER_PALETTES.length] ?? VIP_PALETTE);
  const walking = c.phase === "walking" || c.phase === "leaving";
  drawPerson(ctx, c.x, c.y, palette, walking ? c.walkT : 0, c.facing);
  const px = Math.round(c.x);
  const py = Math.round(c.y);

  if (c.vip) drawCrown(ctx, px, py, UI_TEXT.gold);

  if (c.phase === "waiting") {
    // 吹き出し＋注文ボトル＋待ち時間バー
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
      // おかわりマーク
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

  // 主人公が接客中のハート
  if (c.hostedByPlayer && (c.phase === "waiting" || c.phase === "drinking")) {
    drawHeart(ctx, px - 12, py - 24, UI_TEXT.pink);
  }
}
