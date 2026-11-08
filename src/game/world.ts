import { LOGICAL_H, LOGICAL_W } from "../engine/canvas";
import type { Vec2 } from "../engine/input";
import { FloatingTexts } from "../render/fx";
import { UI_TEXT } from "../render/palette";
import { CELLAR, CUSTOMER, PLAYER, rarityRank } from "./data/balance";
import {
  affinityMultiplier,
  CUSTOMER_TYPE_DEFS,
  CUSTOMER_TYPES,
  type CustomerType,
  INVITE,
  REGULAR,
  TIME_BANDS,
  timeBandOf,
} from "./data/customers";
import { DAY } from "./data/economy";
import { maxGradeForCellar, PRODUCTS, rollOrder } from "./data/products";
import { RACES } from "./data/races";
import { Cellar } from "./entities/cellar";
import { Customer } from "./entities/customer";
import { Host } from "./entities/host";
import { Staff, staffCarryFor, staffSpeedFor, type StaffWorld } from "./entities/staff";
import { Table } from "./entities/table";
import { dohanFee } from "./invitations";
import { CELLAR_POS, ENTRANCE, HOST_STANDBY, TABLE_SLOTS, WALL_BOTTOM } from "./layout";
import { DayLedger } from "./ledger";
import { Player } from "./player";
import type { GameState, Regular } from "./state";
import { distance, formatG } from "./util";

const STAFF_NAMES = ["黒服A", "黒服B", "黒服C", "黒服D", "黒服E", "黒服F"];

export interface WorldTick {
  /** 営業中か。false なら客・酒蔵は止まり、主人公と従業員の移動だけ進む */
  open: boolean;
  /** 20:00 からの分 */
  clockMin: number;
}

/**
 * 店舗1フロアのシミュレーション。エンティティの生成・相互作用・つけ回しを担当する（描画は src/render/）。
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
  ledger = new DayLedger();
  lastSale: { text: string; t: number } | null = null;
  /** 今日すでに来店した太客 */
  private visitedRegulars = new Set<number>();
  private spawnT = 3;
  private pickupT = 0;
  private serveT = 0;
  private clockMin = 0;

  constructor(private readonly state: GameState) {
    this.syncWithState();
  }

  get staffSpeed(): number {
    return staffSpeedFor(this.state.staffLevel);
  }
  get staffCarry(): number {
    return staffCarryFor(this.state.staffLevel);
  }
  get floorClear(): boolean {
    return this.customers.length === 0;
  }

  /** 開店 */
  startDay(): void {
    this.ledger = new DayLedger();
    this.visitedRegulars.clear();
    this.spawnT = 2;
    this.clockMin = 0;
    this.cellar.stock = this.cellar.capacity(this.state.cellarLevel);
    this.lastSale = null;
    this.spawnDohans();
  }

  /** 開店と同時に、同伴の客がホストと一緒に来店する */
  private spawnDohans(): void {
    const s = this.state;
    const maxGrade = maxGradeForCellar(s.cellarLevel);
    const free = this.tables.filter((t) => t.isFree);
    let delay = 0;
    for (const inv of s.dohanOffers) {
      if (inv.status !== "accepted") continue;
      inv.status = "used";
      const regular = s.regulars.find((r) => r.id === inv.regularId);
      const host = this.hosts.find((h) => h.def.id === inv.hostId);
      const table = free.shift();
      if (!regular || !host || !table) continue;

      const order = rollOrder(maxGrade, false);
      const budget = Math.round(
        Math.max(order.price, this.rollBudget(regular.type, false, regular, maxGrade)) * (1 + INVITE.dohanBudgetBonus),
      );
      regular.afterBoost = false;
      const x = ENTRANCE.x + delay;
      const c = new Customer(x, ENTRANCE.y, table, order, { type: regular.type, vip: false, budget, regular, dohan: true }, maxGrade, ENTRANCE.x, ENTRANCE.y);
      table.customer = c;
      this.customers.push(c);
      host.x = x + 10;
      host.y = ENTRANCE.y;
      host.assign(table);
      delay += 14;

      const fee = dohanFee(s.shopLevel);
      s.earn(fee);
      this.ledger.customers += 1;
      this.ledger.regularVisits += 1;
      this.ledger.recordDohanFee(fee, host.def.id);
      this.visitedRegulars.add(regular.id);
      this.floats.add(ENTRANCE.x + 40, ENTRANCE.y - 30 - delay, `${regular.name} と同伴! +${formatG(fee)}`, UI_TEXT.pink);
    }
  }

  /** 閉店。席にいる客を全員帰らせる */
  closeFloor(): void {
    for (const c of this.customers) c.closeOut();
  }

  /** テーブル数・内勤数・出勤ホストを GameState に合わせる（購入・ガチャ・出勤変更後に呼ぶ） */
  syncWithState(): void {
    const s = this.state;
    while (this.tables.length < s.tableCount) {
      const slot = TABLE_SLOTS[this.tables.length];
      if (!slot) break;
      this.tables.push(new Table(this.tables.length, slot.x, slot.y));
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
      const owned = this.state.hosts[def.id];
      if (!owned) return;
      const sx = HOST_STANDBY.x;
      const sy = HOST_STANDBY.y + i * HOST_STANDBY.gap;
      let h = kept.find((k) => k.def.id === def.id);
      if (!h) {
        h = new Host(sx, sy, def, owned, sx, sy);
        this.floats.add(sx - 10, sy - 20, "出勤!", UI_TEXT.pink);
      }
      h.owned = owned;
      h.setStandby(sx, sy);
      next.push(h);
    });
    this.hosts = next;
  }

  onServed(table: Table): void {
    this.floats.add(table.x, table.y - 24, "提供!", UI_TEXT.info);
  }

  // ---------- つけ回し ----------

  /** 方針に従って、ホストのいない卓にホストを着ける */
  private autoAssign(): void {
    const policy = this.state.policy;
    // 来店が早い客から
    const waiting = this.tables
      .filter((t) => t.wantsHost && t.customer)
      .sort((a, b) => (b.customer?.ageMin ?? 0) - (a.customer?.ageMin ?? 0));
    for (const t of waiting) {
      const c = t.customer;
      if (!c) continue;
      const free = this.hosts.filter((h) => h.available);
      if (free.length === 0) return;

      // 指名客: 指名ホストが空いていれば必ずその人
      const nomId = c.nominatedHostId;
      if (nomId) {
        const nominated = free.find((h) => h.def.id === nomId);
        if (nominated) {
          nominated.assign(t);
          continue;
        }
        // 指名優先: 指名ホストが出勤中なら、しばらく空くのを待つ
        const onFloor = this.hosts.some((h) => h.def.id === nomId && h.stamina > 0);
        if (policy === "nomination" && onFloor && c.ageMin < REGULAR.waitForNominatedMin) continue;
      }
      // 指名優先の一見客: 指名客のために高レアを温存しない（手の空いた順）
      const pick = this.pickHost(free, c.type, policy);
      pick?.assign(t);
    }
  }

  private pickHost(free: Host[], type: CustomerType, policy: string): Host | null {
    const score = (h: Host): number => {
      switch (policy) {
        case "affinity":
          return affinityMultiplier(type, h.def.race) * 1000 + h.stamina;
        case "rotation":
          return h.stamina;
        case "ace":
          return rarityRank(h.def.rarity) * 1000 + h.limitBreak * 100 + h.stamina;
        default:
          // 指名優先の一見客: 近い者（待機席の上から）
          return -this.hosts.indexOf(h);
      }
    };
    let best: Host | null = null;
    let bestS = -Infinity;
    for (const h of free) {
      const s = score(h);
      if (s > bestS) {
        bestS = s;
        best = h;
      }
    }
    return best;
  }

  /**
   * 手動のつけ回し。host=null なら「ホストを外す（店長がヘルプ）」。
   * 他の卓にいるホストを選んだ場合は、その卓から外して移す。
   */
  reassign(table: Table, host: Host | null): boolean {
    if (!table.customer || table.customer.phase === "leaving") return false;
    if (host === null) {
      table.host?.release();
      table.autoBlocked = true;
      return true;
    }
    if (host.stamina < 1) return false;
    if (table.host === host) return true;
    table.host?.release();
    table.autoBlocked = false;
    host.assign(table);
    return true;
  }

  /** 主人公の近くにある、客のいる卓（つけ回しプロンプト用） */
  nearestTableForPlayer(): Table | null {
    let best: Table | null = null;
    let bestD = PLAYER.interactRadius * 1.6;
    for (const t of this.tables) {
      if (!t.customer || t.customer.phase === "leaving") continue;
      const d = distance(this.player, { x: t.serveX, y: t.serveY });
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  // ---------- 更新 ----------

  update(dt: number, axis: Vec2, tick: WorldTick): void {
    const s = this.state;
    this.clockMin = tick.clockMin;
    const late = timeBandOf(tick.clockMin) === "late";

    this.player.update(dt, axis, Player.speedFor(s.upgrades.speed), { w: LOGICAL_W, h: LOGICAL_H, top: WALL_BOTTOM + 12 });

    if (tick.open) {
      this.cellar.update(dt, s.cellarLevel);
      this.updatePlayerActions(dt);
      for (const st of this.staff) st.update(dt, this);
      this.autoAssign();
    }
    for (const h of this.hosts) {
      h.lateNight = late;
      h.update(dt, tick.open);
    }

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
      if (c.phase === "leaving" && !c.departureHandled) this.handleDeparture(c);
    }
    this.customers = this.customers.filter((c) => c.phase !== "gone");
  }

  /** 退店時: 太客の好感度更新、一見客の太客化 */
  private handleDeparture(c: Customer): void {
    c.departureHandled = true;
    const s = this.state;
    if (c.leaveReason === "budget") this.ledger.budgetOuts += 1;

    if (c.regular) {
      const r = c.regular;
      r.visits += 1;
      if (c.nominatedServed) this.ledger.nominationsServed += 1;
      if (c.nominatedServed && !c.angry) this.ledger.nominatedRegularIds.push(r.id);
      let delta = 0;
      if (c.angry) delta -= REGULAR.affinityLossAngry;
      else if (c.nominatedServed) delta += REGULAR.affinityGainVisit;
      else delta -= REGULAR.affinityLossNoHost;
      r.affinity = Math.max(0, Math.min(100, r.affinity + delta));
      if (r.affinity <= 0) {
        s.removeRegular(r.id);
        this.ledger.lostRegulars.push(r.name);
        this.floats.add(c.x, c.y - 30, `${r.name} が離れた…`, UI_TEXT.danger);
      }
      return;
    }

    // 一見客の太客化: 怒らず、2杯以上飲み、好みの種族のホストに主に接客された
    if (c.angry || c.drinksHad < REGULAR.convertMinDrinks || !c.servedById) return;
    const def = this.hosts.find((h) => h.def.id === c.servedById)?.def;
    if (!def || !CUSTOMER_TYPE_DEFS[c.type].likes.includes(def.race)) return;
    const chance = REGULAR.convertChance * RACES[def.race].regularFactor;
    if (Math.random() >= chance) return;
    const r = s.addRegular(c.type, def.id);
    if (r) {
      this.ledger.newRegulars.push(`${r.name}（${def.name}）`);
      this.floats.add(c.x, c.y - 30, `${def.name} の太客に!`, UI_TEXT.pink);
    }
  }

  // ---------- 来店 ----------

  private spawnInterval(): number {
    const n = this.state.tableCount;
    const base = Math.max(CUSTOMER.spawnIntervalMin, CUSTOMER.spawnIntervalBase - 0.5 * (n - 1));
    return base * this.state.spawnFactor() * TIME_BANDS[timeBandOf(this.clockMin)].spawnFactor;
  }

  /** 来店時の予算: 提供可能グレードの平均単価 × タイプの杯数 × 時間帯 × VIP × 好感度 */
  private rollBudget(type: CustomerType, vip: boolean, regular: Regular | null, maxGrade: number): number {
    const avail = PRODUCTS.filter((p) => p.grade <= maxGrade);
    const avg = avail.reduce((a, p) => a + p.price, 0) / Math.max(1, avail.length);
    const [lo, hi] = CUSTOMER_TYPE_DEFS[type].budgetDrinks;
    const drinks = lo + Math.random() * (hi - lo);
    const band = TIME_BANDS[timeBandOf(this.clockMin)];
    const aff = regular ? 1 + (regular.affinity / 100) * REGULAR.budgetPerAffinity : 1;
    const after = regular?.afterBoost ? 1 + INVITE.afterBudgetBonus : 1;
    return Math.round(avg * drinks * band.budgetFactor * (vip ? CUSTOMER.vipMultiplier : 1) * aff * after);
  }

  private pickType(): CustomerType {
    const band = timeBandOf(this.clockMin);
    const weights = CUSTOMER_TYPES.map((t) => CUSTOMER_TYPE_DEFS[t].weight[band]);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < CUSTOMER_TYPES.length; i++) {
      r -= weights[i] ?? 0;
      const t = CUSTOMER_TYPES[i];
      if (r < 0 && t) return t;
    }
    return "冒険者";
  }

  /** 今日まだ来ていない太客を、人数に応じた確率で選ぶ（好感度が高いほど来やすい） */
  private pickRegular(): Regular | null {
    const candidates = this.state.regulars.filter((r) => !this.visitedRegulars.has(r.id));
    if (candidates.length === 0) return null;
    let chance = Math.min(REGULAR.visitChanceCap, candidates.length * REGULAR.visitChancePerRegular);
    if (candidates.some((r) => r.afterBoost)) chance = Math.max(chance, INVITE.afterVisitChance);
    if (Math.random() >= chance) return null;
    // アフターの翌回は選ばれやすい
    const weightOf = (r: Regular) => r.affinity * (r.afterBoost ? INVITE.afterVisitWeight : 1);
    const total = candidates.reduce((a, r) => a + weightOf(r), 0);
    let x = Math.random() * total;
    for (const r of candidates) {
      x -= weightOf(r);
      if (x < 0) return r;
    }
    return candidates[0] ?? null;
  }

  private trySpawnCustomer(): void {
    const free = this.tables.filter((t) => t.isFree);
    const table = free[Math.floor(Math.random() * free.length)];
    if (!table) return;
    table.autoBlocked = false;
    const regular = this.pickRegular();
    const type = regular?.type ?? this.pickType();
    const vip = Math.random() < TIME_BANDS[timeBandOf(this.clockMin)].vipChance;
    const maxGrade = maxGradeForCellar(this.state.cellarLevel);
    const order = rollOrder(maxGrade, vip);
    const budget = Math.max(order.price * (vip ? CUSTOMER.vipMultiplier : 1), this.rollBudget(type, vip, regular, maxGrade));
    if (regular) regular.afterBoost = false;
    const c = new Customer(ENTRANCE.x, ENTRANCE.y, table, order, { type, vip, budget, regular }, maxGrade, ENTRANCE.x, ENTRANCE.y);
    table.customer = c;
    this.customers.push(c);
    this.ledger.customers += 1;
    if (regular) {
      this.visitedRegulars.add(regular.id);
      this.ledger.regularVisits += 1;
      const host = this.state.ownedDefs().find((d) => d.id === regular.hostId);
      this.floats.add(ENTRANCE.x + 24, ENTRANCE.y - 30, `${regular.name} 来店（${host?.name ?? "?"} 指名）`, UI_TEXT.pink);
    } else if (vip) {
      this.ledger.vipVisits += 1;
      this.floats.add(ENTRANCE.x + 20, ENTRANCE.y - 30, "VIP来店!", UI_TEXT.vipGold);
    }
  }
}
