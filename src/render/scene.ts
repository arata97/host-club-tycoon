import type { GameState } from "../game/state";
import type { World } from "../game/world";
import { drawCustomer, drawHost, drawPlayer, drawPrompt, drawStaff } from "./entities";
import { drawCellar, drawRoom, drawTable } from "./furniture";

/**
 * 1フレーム分のフロアを描く。ゲームの状態は読むだけで変更しない。
 * グラフィックを差し替えるときは src/render/ 配下だけを触ればよい。
 */
export function drawScene(ctx: CanvasRenderingContext2D, world: World, state: GameState): void {
  drawRoom(ctx, world.hosts.length);
  drawCellar(ctx, world.cellar, state.cellarLevel);
  for (const t of world.tables) drawTable(ctx, t);

  // 人物は y 順に描いて前後関係を出す
  const people: Array<{ y: number; draw: () => void }> = [
    { y: world.player.y, draw: () => drawPlayer(ctx, world.player) },
    ...world.staff.map((s) => ({ y: s.y, draw: () => drawStaff(ctx, s) })),
    ...world.hosts.map((h) => ({ y: h.y, draw: () => drawHost(ctx, h) })),
    ...world.customers.map((c) => ({ y: c.y, draw: () => drawCustomer(ctx, c) })),
  ];
  people.sort((a, b) => a.y - b.y);
  for (const p of people) p.draw();

  // 卓の前に立ったら「E つけ回し」
  if (state.phase === "open" && world.hosts.length > 0) {
    const t = world.nearestTableForPlayer();
    if (t) drawPrompt(ctx, world.player.x, world.player.y, `E つけ回し（${t.host ? t.host.name : "ホストなし"}）`);
  }

  world.floats.draw(ctx);
}

/** ドラッグ操作の仮想スティック */
export function drawStick(
  ctx: CanvasRenderingContext2D,
  stick: { origin: { x: number; y: number }; current: { x: number; y: number } } | null,
  radius: number,
): void {
  if (!stick) return;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(stick.origin.x, stick.origin.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  const dx = stick.current.x - stick.origin.x;
  const dy = stick.current.y - stick.origin.y;
  const len = Math.hypot(dx, dy) || 1;
  const k = Math.min(1, len / radius) * radius;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.arc(stick.origin.x + (dx / len) * k, stick.origin.y + (dy / len) * k, 6, 0, Math.PI * 2);
  ctx.fill();
}
