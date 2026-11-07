import { CELLAR, HOST, PLAYER } from "../data/balance";
import { distance, drawCarriedBottles, drawPerson, moveToward, type PersonPalette } from "../util";
import type { Cellar } from "./cellar";
import type { Table } from "./table";

type HostPhase = "idle" | "toCellar" | "collecting" | "toTable";

const HOST_PALETTE: PersonPalette = { suit: "#1c1826", shirt: "#f4f0ff", skin: "#f1c9a5", hair: "#c0c8d8" };

/** ホストが参照するワールドの最小インターフェース */
export interface HostWorld {
  cellar: Cellar;
  tables: readonly Table[];
  /** 提供に成功したときに呼ぶ（売上計上・演出） */
  onServed(table: Table, server: Host): void;
}

/**
 * 従業員ホスト。酒蔵でボトルを回収し、注文待ちの客に運ぶ、を自律的に繰り返す。
 * フェーズ1では全員同じステータス（N相当）。
 */
export class Host {
  carrying = 0;
  private phase: HostPhase = "idle";
  private target: Table | null = null;
  private walkT = 0;
  private facing: 1 | -1 = 1;
  private actionT = 0;

  constructor(
    public x: number,
    public y: number,
    public readonly name: string,
  ) {}

  update(dt: number, world: HostWorld): void {
    switch (this.phase) {
      case "idle":
        this.decide(world);
        break;

      case "toCellar": {
        const c = world.cellar;
        if (this.walk(c.interactX, c.interactY, dt)) {
          this.phase = "collecting";
          this.actionT = 0;
        }
        break;
      }

      case "collecting": {
        this.actionT += dt;
        if (this.actionT >= CELLAR.pickupInterval) {
          this.actionT = 0;
          if (this.carrying < HOST.carry && world.cellar.take()) this.carrying += 1;
        }
        // 満杯、または在庫切れで1本以上持っていれば配達へ
        if (this.carrying >= HOST.carry || (world.cellar.stock === 0 && this.carrying > 0)) {
          this.phase = "idle";
        } else if (world.cellar.stock === 0 && this.carrying === 0) {
          // 在庫待ち: その場で待機（補充されたら collecting が進む）
        }
        break;
      }

      case "toTable": {
        const t = this.target;
        if (!t || !t.needsService || t.claimedBy !== this) {
          // 客が帰った／別の誰かが提供した
          if (t && t.claimedBy === this) t.claimedBy = null;
          this.target = null;
          this.phase = "idle";
          break;
        }
        if (this.walk(t.serveX, t.serveY, dt) || distance(this, { x: t.serveX, y: t.serveY }) < PLAYER.interactRadius) {
          if (t.customer?.serve()) {
            this.carrying -= 1;
            world.onServed(t, this);
          }
          t.claimedBy = null;
          this.target = null;
          this.phase = "idle";
        }
        break;
      }
    }
  }

  private decide(world: HostWorld): void {
    if (this.carrying > 0) {
      const t = this.nearestUnclaimedWaiting(world.tables);
      if (t) {
        t.claimedBy = this;
        this.target = t;
        this.phase = "toTable";
        return;
      }
      // 待っている客がいない: 満杯でなければ補充に行く
      if (this.carrying < HOST.carry) {
        this.phase = "toCellar";
        return;
      }
      // 満杯で客待ち: 酒蔵前で待機
      this.phase = "toCellar";
      return;
    }
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

  private walk(tx: number, ty: number, dt: number): boolean {
    const prevX = this.x;
    const arrived = moveToward(this, tx, ty, HOST.speed, dt);
    if (this.x !== prevX) this.facing = this.x > prevX ? 1 : -1;
    this.walkT = arrived ? 0 : this.walkT + dt;
    return arrived;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawPerson(ctx, this.x, this.y, HOST_PALETTE, this.walkT, this.facing);
    drawCarriedBottles(ctx, this.x, this.y, this.carrying);
    ctx.font = "6px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(244,231,195,0.8)";
    ctx.fillText(this.name, Math.round(this.x), Math.round(this.y) + 9);
    ctx.textAlign = "left";
  }
}
