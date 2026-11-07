import type { Vec2 } from "../engine/input";
import { PLAYER } from "./data/balance";

/** 主人公（店長）。移動と運搬。提供・接客の判定は World が行う。 */
export class Player {
  x: number;
  y: number;
  carrying = 0;
  facing: 1 | -1 = 1;
  walkT = 0;

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
}
