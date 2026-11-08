import { type SeatDef, seatAccepts, type SeatGrade, SEATS } from "../data/shops";
import type { Customer } from "./customer";
import type { Host } from "./host";
import type { Staff } from "./staff";

/**
 * 客席。客が1人座り、ホストが1人着く。
 * 内勤が提供に向かうときは claimedBy で重複を防ぐ。
 */
export class Table {
  customer: Customer | null = null;
  /** 着いている（向かっている）ホスト */
  host: Host | null = null;
  /** 提供に向かっている内勤 */
  claimedBy: Staff | null = null;
  /** 店長が手動で「ホストを外した」卓。この客が帰るまで自動つけ回しの対象外 */
  autoBlocked = false;
  readonly w = 30;
  readonly h = 16;

  constructor(
    public readonly index: number,
    public x: number,
    public y: number,
    public readonly grade: SeatGrade = "general",
  ) {}

  get seat(): SeatDef {
    return SEATS[this.grade];
  }
  get isPremium(): boolean {
    return this.grade !== "general";
  }
  /** このホストはこの席に着けるか */
  accepts(host: Host): boolean {
    return seatAccepts(this.grade, host.def.rarity);
  }

  /** 客が座る位置（ソファ右側） */
  get seatX(): number {
    return this.x + 7;
  }
  get seatY(): number {
    return this.y - 6;
  }
  /** ホストが着く位置（ソファ左側） */
  get hostX(): number {
    return this.x - 8;
  }
  get hostY(): number {
    return this.y - 6;
  }
  /** 提供・接客する側が立つ位置（手前側） */
  get serveX(): number {
    return this.x;
  }
  get serveY(): number {
    return this.y + 22;
  }

  get isFree(): boolean {
    return this.customer === null;
  }
  get needsService(): boolean {
    return this.customer !== null && this.customer.phase === "waiting";
  }
  /** ホストが着く価値がある（客がいて、まだホストがいない） */
  get wantsHost(): boolean {
    const c = this.customer;
    return c !== null && c.phase !== "leaving" && c.phase !== "gone" && c.phase !== "checkout" && this.host === null && !this.autoBlocked;
  }
}
