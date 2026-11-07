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
