import type { Grade } from "./data/products";

export interface Positioned {
  x: number;
  y: number;
}

/** 目標へ一定速度で近づく。到達したら true。 */
export function moveToward(e: Positioned, tx: number, ty: number, speed: number, dt: number): boolean {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const dist = Math.hypot(dx, dy);
  const step = speed * dt;
  if (dist <= step) {
    e.x = tx;
    e.y = ty;
    return true;
  }
  e.x += (dx / dist) * step;
  e.y += (dy / dist) * step;
  return false;
}

export function distance(a: Positioned, b: Positioned): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function formatG(n: number): string {
  return `${Math.floor(n).toLocaleString("ja-JP")} G`;
}

/** グレードごとのボトル色 */
export const GRADE_COLOR: Record<Grade, string> = {
  1: "#8fd3ff",
  2: "#c77dff",
  3: "#ffd166",
  4: "#ff6b9d",
};

export interface PersonPalette {
  suit: string;
  shirt: string;
  skin: string;
  hair: string;
}

/**
 * 16px 程度の人物ドット絵。(x, y) は足元中央。
 * 主人公・ホスト・客で共有し、パレットで差別化する。
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

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

/** 売上などの浮かび上がるテキスト */
export class FloatingTexts {
  private items: FloatingText[] = [];

  add(x: number, y: number, text: string, color = "#f6c453"): void {
    this.items.push({ x, y, text, color, life: 1.2 });
  }

  update(dt: number): void {
    for (const t of this.items) {
      t.life -= dt;
      t.y -= 18 * dt;
    }
    this.items = this.items.filter((t) => t.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    for (const t of this.items) {
      ctx.globalAlpha = Math.min(1, t.life);
      ctx.fillStyle = "#000";
      ctx.fillText(t.text, Math.round(t.x) + 1, Math.round(t.y) + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, Math.round(t.x), Math.round(t.y));
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }
}
