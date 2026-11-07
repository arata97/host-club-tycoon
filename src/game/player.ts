import type { Vec2 } from "../engine/input";
import { PLAYER } from "./data/balance";
import { drawCarriedBottles, drawPerson, type PersonPalette } from "./util";

const PLAYER_PALETTE: PersonPalette = { suit: "#1c1826", shirt: "#f4f0ff", skin: "#f1c9a5", hair: "#d9a441" };

/** 主人公。移動と運搬。 */
export class Player {
  x: number;
  y: number;
  carrying = 0;
  facing: 1 | -1 = 1;
  private walkT = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  static speedFor(level: number): number {
    return PLAYER.speedBase * (1 + PLAYER.speedPerLevel * level);
  }
  static carryFor(level: number): number {
    return PLAYER.carryBase + level;
  }

  update(dt: number, axis: Vec2, speed: number, bounds: { w: number; h: number; top: number }): void {
    this.x += axis.x * speed * dt;
    this.y += axis.y * speed * dt;
    if (axis.x !== 0) this.facing = axis.x > 0 ? 1 : -1;
    const moving = axis.x !== 0 || axis.y !== 0;
    this.walkT = moving ? this.walkT + dt : 0;

    this.x = Math.max(6, Math.min(bounds.w - 6, this.x));
    this.y = Math.max(bounds.top, Math.min(bounds.h - 2, this.y));
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawPerson(ctx, this.x, this.y, PLAYER_PALETTE, this.walkT, this.facing);
    drawCarriedBottles(ctx, this.x, this.y, this.carrying);
  }
}
