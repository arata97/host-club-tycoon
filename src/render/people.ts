import type { PersonPalette } from "./palette";

/**
 * 16px 程度の人物ドット絵。(x, y) は足元中央。
 * 主人公・内勤・ホスト・客で共有し、パレットで差別化する。
 * スプライト画像に差し替える場合はこの関数の中身だけを変える。
 */
export function drawPerson(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  p: PersonPalette,
  walkT: number,
  facing: 1 | -1,
): void {
  const px = Math.round(x);
  const py = Math.round(y);
  const moving = walkT > 0;
  const bob = moving ? Math.round(Math.sin(walkT * 14)) : 0;
  const step = moving ? Math.round(Math.sin(walkT * 14)) : 0;

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(px - 6, py - 2, 12, 3);

  ctx.fillStyle = p.suit;
  ctx.fillRect(px - 5, py - 10 + bob, 10, 9);
  ctx.fillStyle = p.shirt;
  ctx.fillRect(px - 1, py - 10 + bob, 2, 6);
  ctx.fillStyle = p.skin;
  ctx.fillRect(px - 4, py - 16 + bob, 8, 7);
  ctx.fillStyle = p.hair;
  ctx.fillRect(px - 5, py - 18 + bob, 10, 4);
  ctx.fillRect(px - 5 * facing - (facing > 0 ? 0 : 1), py - 14 + bob, 2, 3);
  ctx.fillStyle = "#1c1826";
  ctx.fillRect(px + (facing > 0 ? 1 : -2), py - 13 + bob, 1, 1);
  ctx.fillStyle = p.suit;
  ctx.fillRect(px - 4, py - 1, 3, 2 + step);
  ctx.fillRect(px + 1, py - 1, 3, 2 - step);
}

/** 頭上に積んだボトルを描く */
export function drawCarriedBottles(ctx: CanvasRenderingContext2D, x: number, y: number, count: number): void {
  const px = Math.round(x);
  const py = Math.round(y);
  for (let i = 0; i < count; i++) {
    const by = py - 22 - i * 5;
    ctx.fillStyle = "#2b6f8f";
    ctx.fillRect(px - 2, by, 4, 4);
    ctx.fillStyle = "#8fd3ff";
    ctx.fillRect(px - 1, by - 2, 2, 2);
  }
}

/** 王冠（VIP） */
export function drawCrown(ctx: CanvasRenderingContext2D, px: number, py: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(px - 3, py - 21, 6, 2);
  ctx.fillRect(px - 3, py - 23, 1, 2);
  ctx.fillRect(px, py - 23, 1, 2);
  ctx.fillRect(px + 2, py - 23, 1, 2);
}

/** 小さなハート */
export function drawHeart(ctx: CanvasRenderingContext2D, px: number, py: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(px, py, 2, 2);
  ctx.fillRect(px + 3, py, 2, 2);
  ctx.fillRect(px, py + 2, 5, 2);
  ctx.fillRect(px + 1, py + 4, 3, 1);
  ctx.fillRect(px + 2, py + 5, 1, 1);
}

/** 足元の名札 */
export function drawNameTag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string): void {
  ctx.font = "6px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.fillText(text, Math.round(x), Math.round(y) + 9);
  ctx.textAlign = "left";
}
