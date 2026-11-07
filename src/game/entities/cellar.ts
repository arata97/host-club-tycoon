import { CELLAR } from "../data/balance";

/** 酒蔵（バーカウンター）。時間でボトルが補充され、近づいた者が回収する。 */
export class Cellar {
  stock = 0;
  private regenT = 0;
  readonly w = 56;
  readonly h = 22;

  constructor(
    public x: number,
    public y: number,
  ) {}

  /** 回収の判定に使う足元位置（カウンターの手前） */
  get interactX(): number {
    return this.x;
  }
  get interactY(): number {
    return this.y + this.h / 2 + 10;
  }

  capacity(level: number): number {
    return CELLAR.capacityBase + CELLAR.capacityPerLevel * (level - 1);
  }
  regenTime(level: number): number {
    return CELLAR.regenBase / (1 + CELLAR.regenPerLevel * (level - 1));
  }

  update(dt: number, level: number): void {
    const cap = this.capacity(level);
    if (this.stock >= cap) {
      this.regenT = 0;
      return;
    }
    this.regenT += dt;
    const t = this.regenTime(level);
    while (this.regenT >= t && this.stock < cap) {
      this.regenT -= t;
      this.stock += 1;
    }
  }

  take(): boolean {
    if (this.stock <= 0) return false;
    this.stock -= 1;
    return true;
  }
}
