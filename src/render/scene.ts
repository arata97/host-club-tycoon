import { LOGICAL_H, LOGICAL_W } from "../engine/canvas";
import { CHAMPAGNE } from "../game/data/shops";
import { ENTRANCE } from "../game/layout";
import type { GameState } from "../game/state";
import type { World } from "../game/world";
import { drawCustomer, drawHost, drawPlayer, drawPrompt, drawShadow, drawStaff } from "./entities";
import { drawCellar, drawRoom, drawTable } from "./furniture";
import { UI_TEXT } from "./palette";

/**
 * 1フレーム分のフロアを描く。ゲームの状態は読むだけで変更しない。
 * グラフィックを差し替えるときは src/render/ 配下だけを触ればよい。
 */
export function drawScene(ctx: CanvasRenderingContext2D, world: World, state: GameState): void {
  drawRoom(ctx, world.hosts.length, state.shopLevel);
  drawCellar(ctx, world.cellar, state.cellarLevel);
  for (const t of world.tables) drawTable(ctx, t);

  // 人物は y 順に描いて前後関係を出す
  const people: Array<{ y: number; draw: () => void }> = [
    { y: world.player.y, draw: () => drawPlayer(ctx, world.player) },
    ...world.staff.map((s) => ({ y: s.y, draw: () => drawStaff(ctx, s) })),
    ...world.hosts.map((h) => ({ y: h.y, draw: () => drawHost(ctx, h, world.champagneT > 0) })),
    ...world.customers.map((c) => ({ y: c.y, draw: () => drawCustomer(ctx, c) })),
  ];
  people.sort((a, b) => a.y - b.y);
  drawShadow(ctx, world.player.x, world.player.y);
  for (const s of world.staff) drawShadow(ctx, s.x, s.y);
  for (const h of world.hosts) drawShadow(ctx, h.x, h.y);
  for (const c of world.customers) drawShadow(ctx, c.x, c.y);
  if (world.vipSpotT > 0) drawVipSpotlight(ctx, Math.min(1, world.vipSpotT));
  for (const p of people) p.draw();

  // 卓の前に立ったら「E つけ回し」
  if (state.phase === "open" && world.hosts.length > 0) {
    const t = world.nearestTableForPlayer();
    if (t) drawPrompt(ctx, world.player.x, world.player.y, `E つけ回し（${t.host ? t.host.name : "ホストなし"}）`);
  }

  world.particles.draw(ctx);
  world.floats.draw(ctx);

  if (world.champagneT > 0) drawChampagneBanner(ctx, world.champagneT);
}

/** VIP 来店時に入口を照らす */
function drawVipSpotlight(ctx: CanvasRenderingContext2D, alpha: number): void {
  ctx.fillStyle = `rgba(255,226,140,${(0.16 * alpha).toFixed(2)})`;
  for (let i = 0; i < 12; i++) {
    const y = ENTRANCE.y - 80 + i * 8;
    const half = 6 + i * 2;
    ctx.fillRect(ENTRANCE.x + 10 - half, y, half * 2, 8);
  }
}

function drawChampagneBanner(ctx: CanvasRenderingContext2D, remainMin: number): void {
  const text = `シャンパンコール！ 全卓の売上×${CHAMPAGNE.multiplier}　残り ${Math.ceil(remainMin)} 分`;
  ctx.font = "bold 8px monospace";
  const w = Math.ceil(ctx.measureText(text).width) + 12;
  const x = Math.round((LOGICAL_W - w) / 2);
  ctx.fillStyle = "rgba(14,9,24,0.85)";
  ctx.fillRect(x, LOGICAL_H - 16, w, 12);
  ctx.fillStyle = UI_TEXT.vipGold;
  ctx.textAlign = "center";
  ctx.fillText(text, LOGICAL_W / 2, LOGICAL_H - 7);
  ctx.textAlign = "left";
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
