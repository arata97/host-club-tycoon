import { HOST_RARITY, type HostStats, type Rarity } from "../data/balance";
import { distance, drawPerson, moveToward, type PersonPalette } from "../util";
import type { Table } from "./table";

type HostPhase = "idle" | "toTable" | "serving" | "toStandby";

export const RARITY_COLOR: Record<Rarity, string> = {
  N: "#c9bfdc",
  R: "#8fd3ff",
  SR: "#c77dff",
  SSR: "#ffd166",
  UR: "#ff6b9d",
};

export interface HostDef {
  name: string;
  rarity: Rarity;
  race: string;
  palette: PersonPalette;
}

/**
 * ホスト。待機席から客のいる卓へ自動で着き、客が帰るまで接客する。
 * 接客中は卓の売上倍率・追加注文・我慢ゲージに効果を与える（効果の適用は Customer 側）。
 * 酒は運ばない。
 */
export class Host {
  phase: HostPhase = "idle";
  table: Table | null = null;
  private walkT = 0;
  private facing: 1 | -1 = 1;
  private animT = 0;

  constructor(
    public x: number,
    public y: number,
    public readonly def: HostDef,
    private readonly standbyX: number,
    private readonly standbyY: number,
  ) {}

  get name(): string {
    return this.def.name;
  }
  get stats(): HostStats {
    return HOST_RARITY[this.def.rarity];
  }

  update(dt: number, tables: readonly Table[]): void {
    this.animT += dt;
    switch (this.phase) {
      case "idle": {
        const t = this.nearestWantingHost(tables);
        if (t) {
          t.host = this;
          this.table = t;
          this.phase = "toTable";
        }
        break;
      }
      case "toTable": {
        const t = this.table;
        if (!t || t.customer === null || t.host !== this) {
          this.release();
          break;
        }
        if (this.walk(t.hostX, t.hostY, dt)) {
          this.phase = "serving";
          this.facing = 1;
          t.customer.attachHost(this);
        }
        break;
      }
      case "serving": {
        const t = this.table;
        if (!t || t.customer === null || t.host !== this) {
          this.release();
          break;
        }
        break;
      }
      case "toStandby": {
        if (this.walk(this.standbyX, this.standbyY, dt)) {
          this.phase = "idle";
          this.facing = -1;
        }
        break;
      }
    }
  }

  /** 客が帰ったとき（Customer から呼ばれる）／卓を離れる */
  release(): void {
    if (this.table && this.table.host === this) this.table.host = null;
    this.table = null;
    this.phase = "toStandby";
  }

  private nearestWantingHost(tables: readonly Table[]): Table | null {
    let best: Table | null = null;
    let bestD = Infinity;
    for (const t of tables) {
      if (!t.wantsHost) continue;
      const d = distance(this, { x: t.hostX, y: t.hostY });
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  private walk(tx: number, ty: number, dt: number): boolean {
    const prevX = this.x;
    const arrived = moveToward(this, tx, ty, this.stats.speed, dt);
    if (this.x !== prevX) this.facing = this.x > prevX ? 1 : -1;
    this.walkT = arrived ? 0 : this.walkT + dt;
    return arrived;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawPerson(ctx, this.x, this.y, this.def.palette, this.walkT, this.facing);
    const px = Math.round(this.x);
    const py = Math.round(this.y);

    if (this.phase === "serving") {
      // 接客中: 音符が浮かぶ
      const bob = Math.round(Math.sin(this.animT * 4) * 2);
      ctx.font = "bold 8px monospace";
      ctx.fillStyle = "#ff8fb3";
      ctx.fillText("♪", px - 10, py - 22 + bob);
    }

    // レア度色の名札
    ctx.font = "6px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = RARITY_COLOR[this.def.rarity];
    ctx.fillText(this.def.name, px, py + 9);
    ctx.textAlign = "left";
  }
}
