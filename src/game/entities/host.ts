import { GACHA, HOST_PATIENCE_DRAIN, HOST_RARITY, type HostingEffect } from "../data/balance";
import { STAMINA } from "../data/customers";
import type { HostDef } from "../data/hosts";
import { RACES } from "../data/races";
import { MONTHLY } from "../data/shops";
import type { OwnedHost } from "../state";
import { moveToward } from "../util";
import type { Table } from "./table";

export type HostPhase = "idle" | "toTable" | "serving" | "toStandby";

export interface HostEffect extends HostingEffect {
  /** 移動速度（論理px/秒） */
  speed: number;
}

/** スタミナによる接客効果の係数（0.5〜1.0） */
export function staminaFactor(stamina: number): number {
  return STAMINA.effectFloor + (1 - STAMINA.effectFloor) * Math.max(0, Math.min(1, stamina / STAMINA.max));
}

/**
 * レア度・種族・限界突破・スタミナ・時間帯からホストの接客効果を求める。
 * stamina / lateNight を省略すると「万全・夜でない」状態（図鑑の表示用）。
 */
export function hostEffect(def: HostDef, limitBreak: number, stamina: number = STAMINA.max, lateNight = false): HostEffect {
  const base = HOST_RARITY[def.rarity];
  const race = RACES[def.race];
  const revenue =
    base.revenueMultiplier *
    (1 + GACHA.limitBreakBonus * limitBreak) *
    (1 + race.revenueBonus + (lateNight ? race.lateRevenueBonus : 0)) *
    staminaFactor(stamina);
  return {
    revenueMultiplier: revenue,
    extraOrders: base.extraOrders,
    orderBonus: Math.min(4, base.orderBonus + race.orderBonus),
    patienceDrain: HOST_PATIENCE_DRAIN * race.patienceFactor,
    speed: base.speed * race.speedFactor,
  };
}

/**
 * ホスト。World のつけ回しで卓を割り当てられ、客が帰るまで接客する。
 * 接客中はスタミナが減り、待機中は回復する。酒は運ばない。
 */
export class Host {
  phase: HostPhase = "idle";
  table: Table | null = null;
  walkT = 0;
  facing: 1 | -1 = -1;
  animT = 0;
  /** 23:00 以降か（吸血鬼の特技用。World が毎フレーム設定） */
  lateNight = false;
  /** 前期の月間No.1か（World が設定） */
  isNo1 = false;

  constructor(
    public x: number,
    public y: number,
    public readonly def: HostDef,
    /** GameState の所持データ（限界突破・スタミナ）への参照 */
    public owned: OwnedHost,
    private standbyX: number,
    private standbyY: number,
  ) {}

  get name(): string {
    return this.def.name;
  }
  get limitBreak(): number {
    return this.owned.lb;
  }
  get stamina(): number {
    return this.owned.stamina;
  }
  get effect(): HostEffect {
    const e = hostEffect(this.def, this.owned.lb, this.owned.stamina, this.lateNight);
    return this.isNo1 ? { ...e, revenueMultiplier: e.revenueMultiplier * (1 + MONTHLY.bonus) } : e;
  }
  /** 卓に着ける状態か（手が空いていて、スタミナが足りている） */
  get available(): boolean {
    return (this.phase === "idle" || this.phase === "toStandby") && this.owned.stamina >= STAMINA.minToServe;
  }

  /** 待機席の位置を変える（出勤メンバーが入れ替わったとき） */
  setStandby(x: number, y: number): void {
    this.standbyX = x;
    this.standbyY = y;
    if (this.phase === "idle") this.phase = "toStandby";
  }

  /** つけ回し: この卓に着く */
  assign(t: Table): void {
    if (this.table && this.table !== t) this.release();
    t.host = this;
    this.table = t;
    this.phase = "toTable";
  }

  update(dt: number, open: boolean): void {
    this.animT += dt;
    const race = RACES[this.def.race];
    switch (this.phase) {
      case "idle":
        if (open) this.regen(dt * STAMINA.regenIdle * race.staminaRegenFactor);
        break;
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
        if (open) {
          this.owned.stamina = Math.max(0, this.owned.stamina - dt * STAMINA.drainServing * race.staminaDrainFactor);
          if (this.owned.stamina <= 0) this.release(); // ダウン
        }
        break;
      }
      case "toStandby": {
        if (open) this.regen(dt * STAMINA.regenIdle * race.staminaRegenFactor);
        if (this.walk(this.standbyX, this.standbyY, dt)) {
          this.phase = "idle";
          this.facing = -1;
        }
        break;
      }
    }
  }

  private regen(amount: number): void {
    this.owned.stamina = Math.min(STAMINA.max, this.owned.stamina + amount);
  }

  /** 卓を離れて待機席へ戻る（客が帰った／入れ替え／ダウン） */
  release(): void {
    const t = this.table;
    if (t) {
      if (t.customer?.host === this) t.customer.detachHost();
      if (t.host === this) t.host = null;
    }
    this.table = null;
    this.phase = "toStandby";
  }

  private walk(tx: number, ty: number, dt: number): boolean {
    const prevX = this.x;
    const arrived = moveToward(this, tx, ty, this.effect.speed, dt);
    if (this.x !== prevX) this.facing = this.x > prevX ? 1 : -1;
    this.walkT = arrived ? 0 : this.walkT + dt;
    return arrived;
  }
}
