import { LOGICAL_H, LOGICAL_W } from "../engine/canvas";
import type { Vec2 } from "../engine/input";
import { FloatingTexts } from "../render/fx";
import { UI_TEXT } from "../render/palette";
import { CELLAR, CUSTOMER, PLAYER } from "./data/balance";
import { DAY } from "./data/economy";
import { maxGradeForCellar, rollOrder } from "./data/products";
import { Cellar } from "./entities/cellar";
import { Customer } from "./entities/customer";
import { Host } from "./entities/host";
import { Staff, staffCarryFor, staffSpeedFor, type StaffWorld } from "./entities/staff";
import { Table } from "./entities/table";
import { CELLAR_POS, ENTRANCE, HOST_STANDBY, TABLE_SLOTS, WALL_BOTTOM } from "./layout";
import { DayLedger } from "./ledger";
import { Player } from "./player";
import type { GameState } from "./state";
import { distance, formatG } from "./util";

const STAFF_NAMES = ["黒服A", "黒服B", "黒服C", "黒服D", "黒服E", "黒服F"];

export interface WorldTick {
  /** 営業中か。false なら客・酒蔵は止まり、主人公と従業員の移動だけ進む */
  open: boolean;
  /** 20:00 からの分 */
  clockMin: number;
}

/**
 * 店舗1フロアのシミュレーション。エンティティの生成・相互作用を担当する（描画は src/render/）。
 * 永続データは GameState が持ち、World は毎フレームそれを参照・更新する。
 */
export class World implements StaffWorld {
  readonly player = new Player(LOGICAL_W / 2, LOGICAL_H / 2 + 20);
  readonly cellar = new Cellar(CELLAR_POS.x, CELLAR_POS.y);
  readonly tables: Table[] = [];
  readonly staff: Staff[] = [];
  /** 出勤中のホスト（待機席の並び順） */
  hosts: Host[] = [];
  customers: Customer[] = [];
  readonly floats = new FloatingTexts();
  /** 今日の売上台帳 */
  ledger = new DayLedger();
  /** 直近に提供した売上（HUD演出用） */
  lastSale: { text: string; t: number } | null = null;
  private spawnT = 3;
  private pickupT = 0;
  private serveT = 0;

  constructor(private readonly state: GameState) {
    this.syncWithState();
  }

  get staffSpeed(): number {
    return staffSpeedFor(this.state.staffLevel);
  }
  get staffCarry(): number {
    return staffCarryFor(this.state.staffLevel);
  }
  /** 客が全員いなくなったか */
  get floorClear(): boolean {
    return this.customers.length === 0;
  }

  /** 開店。台帳を新しくし、最初の客までの間を短くする */
  startDay(): void {
    this.ledger = new DayLedger();
    this.spawnT = 2;
    this.cellar.stock = this.cellar.capacity(this.state.cellarLevel);
    this.lastSale = null;
  }

  /** 閉店。席にいる客を全員帰らせる */
  closeFloor(): void {
    for (const c of this.customers) c.closeOut();
  }

  /** テーブル数・内勤数・出勤ホストを GameState に合わせる（購入・ガチャ後に呼ぶ） */
  syncWithState(): void {
    const s = this.state;
    while (this.tables.length < s.tableCount) {
      const slot = TABLE_SLOTS[this.tables.length];
      if (!slot) break;
      this.tables.push(new Table(slot.x, slot.y));
    }
    while (this.staff.length < s.staffCount) {
      const name = STAFF_NAMES[this.staff.length] ?? "黒服";
      this.staff.push(new Staff(this.cellar.interactX - 24 + this.staff.length * 8, this.cellar.interactY + 12, name));
    }
    this.syncHosts();
  }

  private syncHosts(): void {
    const desired = this.state.onFloorDefs();
    const desiredIds = new Set(desired.map((d) => d.id));
    for (const h of this.hosts) if (!desiredIds.has(h.def.id)) h.release();
    const kept = this.hosts.filter((h) => desiredIds.has(h.def.id));

    const next: Host[] = [];
    desired.forEach((def, i) => {
      const sx = HOST_STANDBY.x;
      const sy = HOST_STANDBY.y + i * HOST_STANDBY.gap;
      let h = kept.find((k) => k.def.id === def.id);
      if (!h) {
        h = new Host(sx, sy, def, this.state.limitBreak(def.id), sx, sy);
        this.floats.add(sx - 10, sy - 20, "出勤!", UI_TEXT.pink);
      }
      h.limitBreak = this.state.limitBreak(def.id);
      h.setStandby(sx, sy);
      next.push(h);
    });
    this.hosts = next;
  }

  onServed(table: Table): void {
    this.floats.add(table.x, table.y - 24, "提供!", UI_TEXT.info);
  }

  update(dt: number, axis: Vec2, tick: WorldTick): void {
    const s = this.state;

    // 主人公
    this.player.update(dt, axis, Player.speedFor(s.upgrades.speed), { w: LOGICAL_W, h: LOGICAL_H, top: WALL_BOTTOM + 12 });

    if (tick.open) {
      this.cellar.update(dt, s.cellarLevel);
      this.updatePlayerActions(dt);
      for (const st of this.staff) st.update(dt, this);
    }
    // ホストは閉店後も待機席へ戻る動きだけ続ける
    for (const h of this.hosts) h.update(dt, this.tables);

    // 客の生成（ラストオーダーまで）
    if (tick.open && tick.clockMin < DAY.lastOrderMin) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = this.spawnInterval();
        this.trySpawnCustomer();
      }
    }

    this.updateCustomers(dt);

    this.floats.update(dt);
    if (this.lastSale) {
      this.lastSale.t -= dt;
      if (this.lastSale.t <= 0) this.lastSale = null;
    }
  }

  /** 主人公の自動回収・提供・接客 */
  private updatePlayerActions(dt: number): void {
    const s = this.state;
    this.pickupT += dt;
    const carryMax = Player.carryFor(s.upgrades.carry);
    if (
      this.player.carrying < carryMax &&
      distance(this.player, { x: this.cellar.interactX, y: this.cellar.interactY }) < PLAYER.interactRadius
    ) {
      if (this.pickupT >= CELLAR.pickupInterval && this.cellar.take()) {
        this.pickupT = 0;
        this.player.carrying += 1;
      }
    }

    this.serveT += dt;
    for (const t of this.tables) {
      const c = t.customer;
      const near = distance(this.player, { x: t.serveX, y: t.serveY }) < PLAYER.interactRadius;
      if (c && c.phase !== "walking") c.setPlayerHosting(near);
      if (near && t.needsService && this.player.carrying > 0 && this.serveT >= PLAYER.serveInterval) {
        if (c?.serve()) {
          this.player.carrying -= 1;
          this.serveT = 0;
          t.claimedBy = null;
          this.onServed(t);
        }
      }
    }
  }

  private updateCustomers(dt: number): void {
    const s = this.state;
    const globalMult = s.globalRevenueMultiplier();
    for (const c of this.customers) {
      // startLeaving で host が外れるため、更新前に担当を控える
      const hostId = c.host?.def.id ?? null;
      const hostName = c.host?.name ?? (c.hostedByPlayer ? "店長" : null);
      const byPlayer = c.hostedByPlayer;
      const ev = c.update(dt);
      if (ev === "paid") {
        const amount = Math.round(c.lastPaid * globalMult);
        s.earn(amount);
        this.ledger.recordSale(amount, c.lastOrder, hostId, byPlayer);
        this.floats.add(c.table.x, c.table.y - 30, `+${formatG(amount)}`, c.vip ? UI_TEXT.vipGold : UI_TEXT.gold);
        const who = hostName ? `[${hostName}] ` : "";
        this.lastSale = { text: `${who}${c.vip ? "VIP " : ""}${c.lastOrder.name} ${formatG(amount)}`, t: 3 };
      } else if (ev === "gaveUp") {
        this.ledger.walkouts += 1;
        this.floats.add(c.table.x, c.table.y - 30, "帰った…", UI_TEXT.danger);
      }
    }
    this.customers = this.customers.filter((c) => c.phase !== "gone");
  }

  private spawnInterval(): number {
    const n = this.state.tableCount;
    const base = Math.max(CUSTOMER.spawnIntervalMin, CUSTOMER.spawnIntervalBase - 0.5 * (n - 1));
    return base * this.state.spawnFactor();
  }

  private trySpawnCustomer(): void {
    const free = this.tables.filter((t) => t.isFree);
    const table = free[Math.floor(Math.random() * free.length)];
    if (!table) return;
    const vip = Math.random() < CUSTOMER.vipChance;
    const maxGrade = maxGradeForCellar(this.state.cellarLevel);
    const order = rollOrder(maxGrade, vip);
    const c = new Customer(ENTRANCE.x, ENTRANCE.y, table, order, vip, maxGrade, ENTRANCE.x, ENTRANCE.y);
    table.customer = c;
    this.customers.push(c);
    this.ledger.customers += 1;
    if (vip) {
      this.ledger.vipVisits += 1;
      this.floats.add(ENTRANCE.x + 20, ENTRANCE.y - 30, "VIP来店!", UI_TEXT.vipGold);
    }
  }
}
