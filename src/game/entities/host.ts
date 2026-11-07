import { GACHA, HOST_PATIENCE_DRAIN, HOST_RARITY, type HostingEffect } from "../data/balance";
import type { HostDef } from "../data/hosts";
import { RACES } from "../data/races";
import { distance, moveToward } from "../util";
import type { Table } from "./table";

export type HostPhase = "idle" | "toTable" | "serving" | "toStandby";

export interface HostEffect extends HostingEffect {
  /** 移動速度（論理px/秒） */
  speed: number;
}

/** レア度・種族・限界突破からホストの接客効果を求める */
export function hostEffect(def: HostDef, limitBreak: number): HostEffect {
  const base = HOST_RARITY[def.rarity];
  const race = RACES[def.race];
  return {
    revenueMultiplier: base.revenueMultiplier * (1 + GACHA.limitBreakBonus * limitBreak) * (1 + race.revenueBonus),
    extraOrders: base.extraOrders + race.extraOrders,
    orderBonus: Math.min(4, base.orderBonus + race.orderBonus),
    patienceDrain: HOST_PATIENCE_DRAIN * race.patienceFactor,
    speed: base.speed * race.speedFactor,
  };
}

/**
 * ホスト。待機席から客のいる卓へ自動で着き、客が帰るまで接客する。
 * 接客の効果は Customer 側が effect を参照して適用する。酒は運ばない。
 */
export class Host {
  phase: HostPhase = "idle";
  table: Table | null = null;
  walkT = 0;
  facing: 1 | -1 = -1;
  animT = 0;

  constructor(
    public x: number,
    public y: number,
    public readonly def: HostDef,
    public limitBreak: number,
    private standbyX: number,
    private standbyY: number,
  ) {}

  get name(): string {
    return this.def.name;
  }
  get effect(): HostEffect {
    return hostEffect(this.def, this.limitBreak);
  }

  /** 待機席の位置を変える（出勤メンバーが入れ替わったとき） */
  setStandby(x: number, y: number): void {
    this.standbyX = x;
    this.standbyY = y;
    if (this.phase === "idle") this.phase = "toStandby";
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
        if (!t || t.customer === null || t.host !== this) this.release();
        break;
      }
      case "toStandby": {
        // 待機席へ戻る途中でも、客が待っていればそちらへ向かう
        const t = this.nearestWantingHost(tables);
        if (t) {
          t.host = this;
          this.table = t;
          this.phase = "toTable";
          break;
        }
        if (this.walk(this.standbyX, this.standbyY, dt)) {
          this.phase = "idle";
          this.facing = -1;
        }
        break;
      }
    }
  }

  /** 卓を離れて待機席へ戻る（客が帰ったとき／出勤メンバーから外れたとき） */
  release(): void {
    const t = this.table;
    if (t) {
      if (t.customer?.host === this) t.customer.detachHost();
      if (t.host === this) t.host = null;
    }
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
    const arrived = moveToward(this, tx, ty, this.effect.speed, dt);
    if (this.x !== prevX) this.facing = this.x > prevX ? 1 : -1;
    this.walkT = arrived ? 0 : this.walkT + dt;
    return arrived;
  }
}
