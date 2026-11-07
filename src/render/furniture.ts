import { LOGICAL_H, LOGICAL_W } from "../engine/canvas";
import type { Cellar } from "../game/entities/cellar";
import type { Table } from "../game/entities/table";
import { ENTRANCE, HOST_STANDBY, WALL_BOTTOM } from "../game/layout";
import { ROOM, UI_TEXT } from "./palette";

export function drawRoom(ctx: CanvasRenderingContext2D, standbyCount: number): void {
  ctx.fillStyle = ROOM.wall;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  const tile = 20;
  for (let y = WALL_BOTTOM; y < LOGICAL_H; y += tile) {
    for (let x = 0; x < LOGICAL_W; x += tile) {
      const odd = ((x / tile + y / tile) & 1) === 1;
      ctx.fillStyle = odd ? ROOM.floorA : ROOM.floorB;
      ctx.fillRect(x, y, tile, tile);
    }
  }
  ctx.fillStyle = ROOM.wallTrim;
  ctx.fillRect(0, WALL_BOTTOM - 6, LOGICAL_W, 6);
  for (let x = 30; x < LOGICAL_W - 80; x += 60) {
    ctx.fillStyle = ROOM.lightGlow;
    ctx.fillRect(x - 8, 20, 20, 14);
    ctx.fillStyle = ROOM.light;
    ctx.fillRect(x, 14, 4, 6);
  }
  // 入口（左下）
  ctx.fillStyle = ROOM.entrance;
  ctx.fillRect(0, ENTRANCE.y - 30, 14, 40);
  ctx.fillStyle = ROOM.light;
  ctx.fillRect(2, ENTRANCE.y - 28, 10, 2);
  ctx.font = "6px monospace";
  ctx.fillStyle = ROOM.label;
  ctx.fillText("入口", 16, ENTRANCE.y - 22);
  // ホスト待機席（右端のベンチ）
  if (standbyCount > 0) {
    const top = HOST_STANDBY.y - 14;
    const h = standbyCount * HOST_STANDBY.gap + 4;
    ctx.fillStyle = ROOM.bench;
    ctx.fillRect(HOST_STANDBY.x - 12, top, 24, h);
    ctx.fillStyle = ROOM.label;
    ctx.fillText("待機", HOST_STANDBY.x - 6, top - 3);
  }
}

export function drawTable(ctx: CanvasRenderingContext2D, t: Table): void {
  const x = Math.round(t.x - t.w / 2);
  const y = Math.round(t.y - t.h / 2);
  // ソファ（奥）
  ctx.fillStyle = "#7a1f3a";
  ctx.fillRect(x - 4, y - 10, t.w + 8, 8);
  ctx.fillStyle = "#a02a4e";
  ctx.fillRect(x - 4, y - 10, t.w + 8, 2);
  // テーブル
  ctx.fillStyle = "#1e1a2a";
  ctx.fillRect(x, y + 2, t.w, t.h);
  ctx.fillStyle = "#3a3350";
  ctx.fillRect(x, y, t.w, t.h);
  ctx.fillStyle = "#5c5378";
  ctx.fillRect(x + 1, y + 1, t.w - 2, 2);
  // キャンドル
  ctx.fillStyle = UI_TEXT.gold;
  ctx.fillRect(Math.round(t.x), y + 5, 2, 3);
  ctx.fillStyle = "#fff2b0";
  ctx.fillRect(Math.round(t.x), y + 4, 2, 1);
}

export function drawCellar(ctx: CanvasRenderingContext2D, c: Cellar, level: number): void {
  const x = Math.round(c.x - c.w / 2);
  const y = Math.round(c.y - c.h / 2);
  // 背面の棚
  ctx.fillStyle = "#3b2a1e";
  ctx.fillRect(x, y - 16, c.w, 16);
  ctx.fillStyle = "#5a3f2c";
  ctx.fillRect(x, y - 16, c.w, 2);
  ctx.fillRect(x, y - 8, c.w, 2);
  // 棚のボトル（在庫数ぶん）
  const cap = c.capacity(level);
  for (let i = 0; i < cap; i++) {
    const bx = x + 4 + (i % 12) * 4;
    const by = y - 14 + Math.floor(i / 12) * 8;
    if (i < c.stock) {
      ctx.fillStyle = "#2b6f8f";
      ctx.fillRect(bx, by, 3, 5);
      ctx.fillStyle = "#8fd3ff";
      ctx.fillRect(bx + 1, by - 1, 1, 1);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(bx, by, 3, 5);
    }
  }
  // カウンター
  ctx.fillStyle = "#6b4a2f";
  ctx.fillRect(x, y, c.w, c.h);
  ctx.fillStyle = "#8a6240";
  ctx.fillRect(x, y, c.w, 4);
  ctx.fillStyle = "#4a3220";
  ctx.fillRect(x, y + c.h - 3, c.w, 3);
  // ラベル
  ctx.font = "7px monospace";
  ctx.fillStyle = UI_TEXT.cream;
  ctx.textAlign = "center";
  ctx.fillText(`酒蔵 Lv${level}`, c.x, y + 14);
  ctx.textAlign = "left";
}
