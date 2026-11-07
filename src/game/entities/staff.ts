import { CELLAR, PLAYER, STAFF } from "../data/balance";
import { distance, drawCarriedBottles, drawPerson, moveToward, type PersonPalette } from "../util";
import type { Cellar } from "./cellar";
import type { Table } from "./table";

type StaffPhase = "idle" | "toCellar" | "collecting" | "toTable";

const STAFF_PALETTE: PersonPalette = { suit: "#141020", shirt: "#e8e8f0", skin: "#f1c9a5", hair: "#2a2a2a" };

/** 内勤が参照するワールドの最小インターフェース */
export interface StaffWorld {
  cellar: Cellar;
  tables: readonly Table[];
  /** 内勤の共通ステータス（教育Lvで変わる） */
  staffSpeed: number;
  staffCarry: number;
  /** 提供に成功したときに呼ぶ（演出） */
  onServed(table: Table): void;
}

/**
 * 内勤（黒服）。酒蔵でボトルを回収し、注文待ちの客に運ぶ、を自律的に繰り返す。
 * 接客はしない。
 */
export class Staff {
  carrying = 0;
  private phase: StaffPhase = "idle";
  private target: Table | null = null;
  private walkT = 0;
  private facing: 1 | -1 = 1;
  private actionT = 0;

  constructor(
    public x: number,
    public y: number,
    public readonly name: string,
  ) {}

  update(dt: number, world: StaffWorld): void {
    switch (this.phase) {
      case "idle":
        this.decide(world);
        break;

      case "toCellar": {
        const c = world.cellar;
        if (this.walk(c.interactX, c.interactY, world.staffSpeed, dt)) {
          this.phase = "collecting";
          this.actionT = 0;
        }
        break;
      }

      case "collecting": {
        this.actionT += dt;
        if (this.actionT >= CELLAR.pickupInterval) {
          this.actionT = 0;
          if (this.carrying < world.staffCarry && world.cellar.take()) this.carrying += 1;
        }
        // 満杯、または在庫切れで1本以上持っていれば配達へ。在庫待ちはその場で待機
        if (this.carrying >= world.staffCarry || (world.cellar.stock === 0 && this.carrying > 0)) {
          this.phase = "idle";
        }
        break;
      }

      case "toTable": {
        const t = this.target;
        if (!t || !t.needsService || t.claimedBy !== this) {
          if (t && t.claimedBy === this) t.claimedBy = null;
          this.target = null;
          this.phase = "idle";
          break;
        }
        if (
          this.walk(t.serveX, t.serveY, world.staffSpeed, dt) ||
          distance(this, { x: t.serveX, y: t.serveY }) < PLAYER.interactRadius
        ) {
          if (t.customer?.serve()) {
            this.carrying -= 1;
            world.onServed(t);
          }
          t.claimedBy = null;
          this.target = null;
          this.phase = "idle";
        }
        break;
      }
    }
  }

  private decide(world: StaffWorld): void {
    if (this.carrying > 0) {
      const t = this.nearestUnclaimedWaiting(world.tables);
      if (t) {
        t.claimedBy = this;
        this.target = t;
        this.phase = "toTable";
        return;
      }
    }
    // 持っていない、または客待ちがいない → 酒蔵へ（満杯なら酒蔵前で待機）
    this.phase = "toCellar";
  }

  private nearestUnclaimedWaiting(tables: readonly Table[]): Table | null {
    let best: Table | null = null;
    let bestD = Infinity;
    for (const t of tables) {
      if (!t.needsService || t.claimedBy) continue;
      const d = distance(this, { x: t.serveX, y: t.serveY });
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  private walk(tx: number, ty: number, speed: number, dt: number): boolean {
    const prevX = this.x;
    const arrived = moveToward(this, tx, ty, speed, dt);
    if (this.x !== prevX) this.facing = this.x > prevX ? 1 : -1;
    this.walkT = arrived ? 0 : this.walkT + dt;
    return arrived;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawPerson(ctx, this.x, this.y, STAFF_PALETTE, this.walkT, this.facing);
    drawCarriedBottles(ctx, this.x, this.y, this.carrying);
    // 蝶ネクタイ
    ctx.fillStyle = "#c94f7c";
    ctx.fillRect(Math.round(this.x) - 1, Math.round(this.y) - 10, 2, 1);
    ctx.font = "6px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(200,200,220,0.75)";
    ctx.fillText(this.name, Math.round(this.x), Math.round(this.y) + 9);
    ctx.textAlign = "left";
  }
}

/** 内勤教育Lvから移動速度を求める */
export function staffSpeedFor(level: number): number {
  return STAFF.speedBase * (1 + STAFF.speedPerLevel * level);
}
/** 内勤教育Lvから運搬数を求める */
export function staffCarryFor(level: number): number {
  return STAFF.carryBase + Math.floor(level / STAFF.carryPerLevels);
}
