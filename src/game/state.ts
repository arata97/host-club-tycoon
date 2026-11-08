import { GACHA, RARITIES, type Rarity, rarityRank, SAVE, UPGRADES, type UpgradeKey, upgradeCost } from "./data/balance";
import { type AssignPolicy, CUSTOMER_TYPES, type CustomerType, REGULAR, regularName, STAMINA } from "./data/customers";
import { LOAN, startingCash } from "./data/economy";
import { HOST_ROSTER, type HostDef } from "./data/hosts";
import { CARRIAGE, CHECKOUT, MAX_SHOP_LEVEL, MONTHLY, type SeatGrade, SEAT_GRADES, SEATS, shopDef, type ShopDef, upgradeCap } from "./data/shops";
import type { DayReport, HostPay } from "./ledger";

export interface OwnedHost {
  /** 限界突破段階（0〜GACHA.limitBreakMax） */
  lb: number;
  /** スタミナ 0〜100 */
  stamina: number;
}

/** 太客（常連）。特定のホストを指名して来店する */
export interface Regular {
  id: number;
  name: string;
  type: CustomerType;
  /** 指名しているホスト */
  hostId: string;
  /** 好感度 0〜100。0 で店を離れる */
  affinity: number;
  visits: number;
  /** アフターの直後。次回の来店が早まり予算が増える（来店で消費） */
  afterBoost: boolean;
}

/**
 * 同伴・アフターの誘い。
 * accepted は受けた状態、used は同伴が当日の来店に使われた状態（その日は出勤確定のまま）。
 */
export interface Invitation {
  id: number;
  kind: "after" | "dohan";
  regularId: number;
  regularName: string;
  hostId: string;
  status: "pending" | "accepted" | "declined" | "used";
}

/** 1日の中の状態。preopen=開店前（時間停止）、open=営業中、closing=閉店精算、bankrupt=倒産画面 */
export type DayPhase = "preopen" | "open" | "closing" | "bankrupt";

/** 出勤メンバーの決め方。auto=レア度順、manual=手動で選んだ人 */
export type RosterMode = "auto" | "manual";

/** セーブに含める永続データ。エンティティの瞬間的な位置などは含めない。 */
export interface SaveData {
  v: number;
  money: number;
  debt: number;
  totalRevenue: number;
  upgrades: Record<UpgradeKey, number>;
  shopLevel: number;
  hosts: Record<string, OwnedHost>;
  pity: number;
  totalPulls: number;
  day: number;
  clockMin: number;
  phase: DayPhase;
  negativeDays: number;
  rebirths: number;
  recentSales: number[];
  lastReport: DayReport | null;
  regulars: Regular[];
  nextRegularId: number;
  policy: AssignPolicy;
  rosterMode: RosterMode;
  manualRoster: string[];
  dohanOffers: Invitation[];
  nextInvitationId: number;
  monthSales: Record<string, number>;
  monthDays: number;
  no1HostId: string | null;
  savedAt: number;
}

/** v2 セーブの「スカウト人数」を v3 の所持ホストに移行するときの順序 */
const LEGACY_V2_SCOUT_ORDER = ["ren", "kakeru", "yuu", "garon", "rio", "rui"];
const POLICIES: readonly AssignPolicy[] = ["affinity", "nomination", "rotation", "ace"];

export class GameState {
  /** 現金 */
  money = startingCash(0);
  debt: number = LOAN.initialDebt;
  totalRevenue = 0;
  upgrades: Record<UpgradeKey, number> = {
    table: 0,
    vip: 0,
    exe: 0,
    throne: 0,
    register: 0,
    carriage: 0,
    cellar: 0,
    speed: 0,
    carry: 0,
    staff: 0,
    staffLv: 0,
  };
  /** 現在の店舗（1〜6）。移転で上がる */
  shopLevel = 1;
  hosts: Record<string, OwnedHost> = {};
  pity = 0;
  totalPulls = 0;

  // ---- 営業日 ----
  day = 1;
  /** 営業中の時刻（20:00 からの分） */
  clockMin = 0;
  phase: DayPhase = "preopen";
  /** 閉店時に現金がマイナスだった連続日数 */
  negativeDays = 0;
  rebirths = 0;
  /** 直近の日次売上（借入上限の計算用） */
  recentSales: number[] = [];
  lastReport: DayReport | null = null;

  // ---- 客・つけ回し ----
  regulars: Regular[] = [];
  nextRegularId = 1;
  policy: AssignPolicy = "affinity";
  rosterMode: RosterMode = "auto";
  manualRoster: string[] = [];

  // ---- 同伴・アフター ----
  /** 閉店時に届いたアフターの誘い（閉店画面でのみ使い、セーブしない） */
  afterOffers: Invitation[] = [];
  /** 翌日の同伴の誘い。受けたものは当日の閉店後まで残る */
  dohanOffers: Invitation[] = [];
  nextInvitationId = 1;

  // ---- 月間No.1（店舗4以降） ----
  monthSales: Record<string, number> = {};
  monthDays = 0;
  no1HostId: string | null = null;

  // ---------- 店舗 ----------

  get shop(): ShopDef {
    return shopDef(this.shopLevel);
  }

  /** その席の現在の数（店舗の上限を超えて買っていた分は数えない） */
  seatCount(grade: SeatGrade): number {
    const seats = this.shop.seats;
    switch (grade) {
      case "general":
        return Math.min(1 + this.upgrades.table, seats.general);
      case "vip":
        return Math.min(this.upgrades.vip, seats.vip);
      case "exe":
        return Math.min(this.upgrades.exe, seats.exe);
      case "god":
        return Math.min(this.upgrades.throne, seats.god);
    }
  }

  /** 全席の数。出勤枠もこの数 */
  get tableCount(): number {
    return SEAT_GRADES.reduce((a, g) => a + this.seatCount(g), 0);
  }

  /** このホストたち全員を、着ける席に座らせられるか（同伴の受諾判定） */
  canSeatHosts(ids: readonly string[]): boolean {
    const ranks = ids.map((id) => rarityRank(HOST_ROSTER.find((d) => d.id === id)?.rarity ?? "N"));
    let seats = 0;
    for (let i = 0; i < SEAT_GRADES.length; i++) {
      const grade = SEAT_GRADES[i];
      if (!grade) continue;
      seats += this.seatCount(grade);
      const upper = SEAT_GRADES[i + 1];
      const upperMin = upper ? rarityRank(SEATS[upper].minRarity ?? "N") : Infinity;
      // ここより上の席に着けないホストは、ここまでの席に収まる必要がある
      if (ranks.filter((r) => r < upperMin).length > seats) return false;
    }
    return true;
  }

  get nextShop(): ShopDef | null {
    return this.shopLevel < MAX_SHOP_LEVEL ? shopDef(this.shopLevel + 1) : null;
  }

  /** 次の店舗へ移転できない理由（資金以外）。条件を満たしていれば null */
  relocationBlock(): string | null {
    const next = this.nextShop;
    if (!next) return "これ以上の店舗はありません";
    if (next.needsFullCollection) {
      const missing = HOST_ROSTER.filter((d) => !this.owns(d.id)).length;
      if (missing > 0) return `図鑑の完成が条件です（あと ${missing} 人）`;
    }
    if (this.totalRevenue < next.unlockRevenue) return "累計売上が足りません";
    return null;
  }

  /** 移転費用に足りない額 */
  relocationShortfall(): number {
    const next = this.nextShop;
    return next ? Math.max(0, next.moveCost - this.money) : 0;
  }

  /** 次の店舗へ移転する。borrow なら足りない分を借りる。設備と内勤は持っていく */
  relocate(borrow = false): boolean {
    const next = this.nextShop;
    if (!next || this.relocationBlock() !== null) return false;
    const shortfall = Math.ceil(this.relocationShortfall());
    if (shortfall > 0 && (!borrow || !this.borrow(shortfall))) return false;
    this.money -= next.moveCost;
    this.shopLevel = next.level;
    return true;
  }

  /** レジが動いているか（会計を代行する内勤が必要） */
  get registerActive(): boolean {
    return this.upgrades.register > 0 && this.staffCount > 0;
  }

  /** 帰る客の会計にかかる時間（分）。0 なら会計なし */
  get checkoutMin(): number {
    if (this.shopLevel < CHECKOUT.fromShop) return 0;
    return this.registerActive ? CHECKOUT.registerMin : CHECKOUT.waitMin;
  }

  /** 閉店時に担当売上を集計し、期間の最終日なら月間No.1を発表する */
  recordMonthly(pays: readonly HostPay[]): { name: string; sales: number } | null {
    if (this.shopLevel < MONTHLY.fromShop) return null;
    for (const p of pays) this.monthSales[p.id] = (this.monthSales[p.id] ?? 0) + p.sales;
    this.monthDays += 1;
    if (this.monthDays < MONTHLY.days) return null;

    let top: string | null = null;
    let topSales = 0;
    for (const [id, sales] of Object.entries(this.monthSales)) {
      if (sales > topSales) {
        top = id;
        topSales = sales;
      }
    }
    this.no1HostId = top;
    this.monthSales = {};
    this.monthDays = 0;
    const name = HOST_ROSTER.find((d) => d.id === top)?.name;
    return name ? { name, sales: topSales } : null;
  }

  upgradeLimit(key: UpgradeKey): number {
    return upgradeCap(key, this.shopLevel);
  }
  get cellarLevel(): number {
    return 1 + this.upgrades.cellar;
  }
  get staffCount(): number {
    return this.upgrades.staff;
  }
  get staffLevel(): number {
    return this.upgrades.staffLv;
  }

  costOf(key: UpgradeKey): number {
    return upgradeCost(key, this.upgrades[key]);
  }
  isMaxed(key: UpgradeKey): boolean {
    return this.upgrades[key] >= this.upgradeLimit(key);
  }
  canBuy(key: UpgradeKey): boolean {
    return !this.isMaxed(key) && this.money >= this.costOf(key);
  }
  buy(key: UpgradeKey): boolean {
    if (!this.canBuy(key)) return false;
    this.money -= this.costOf(key);
    this.upgrades[key] += 1;
    return true;
  }

  earn(amount: number): void {
    this.money += amount;
    this.totalRevenue += amount;
  }

  // ---------- 借金 ----------

  /** 借金残高の上限 ＝ 開業資金 ＋ max(下限, 直近7日の売上 × 倍率) */
  borrowLimit(): number {
    const recent = this.recentSales.slice(-LOAN.limitSalesDays).reduce((a, b) => a + b, 0);
    return LOAN.initialDebt + Math.max(LOAN.limitFloor, recent * LOAN.limitMultiplier);
  }
  borrowable(): number {
    return Math.max(0, this.borrowLimit() - this.debt);
  }
  borrow(amount: number): boolean {
    const a = Math.floor(amount);
    if (a <= 0 || a > this.borrowable()) return false;
    this.debt += a;
    this.money += a;
    return true;
  }
  repay(amount: number): boolean {
    const a = Math.min(Math.floor(amount), this.debt, Math.floor(this.money));
    if (a <= 0) return false;
    this.debt -= a;
    this.money -= a;
    return true;
  }
  recordDaySales(sales: number): void {
    this.recentSales.push(sales);
    if (this.recentSales.length > 30) this.recentSales.shift();
  }

  /** 倒産 → 再転生。図鑑・天井・転生回数を引き継ぎ、店・金・太客はリセット */
  reincarnate(): void {
    const keep = {
      hosts: this.hosts,
      pity: this.pity,
      totalPulls: this.totalPulls,
      rebirths: this.rebirths + 1,
      policy: this.policy,
    };
    Object.assign(this, new GameState());
    this.hosts = keep.hosts;
    for (const h of Object.values(this.hosts)) h.stamina = STAMINA.max;
    this.pity = keep.pity;
    this.totalPulls = keep.totalPulls;
    this.rebirths = keep.rebirths;
    this.policy = keep.policy;
    this.money = startingCash(this.rebirths);
  }

  // ---------- ホスト ----------

  owns(id: string): boolean {
    return this.hosts[id] !== undefined;
  }
  limitBreak(id: string): number {
    return this.hosts[id]?.lb ?? 0;
  }
  stamina(id: string): number {
    return this.hosts[id]?.stamina ?? STAMINA.max;
  }
  ownedDefs(): HostDef[] {
    return HOST_ROSTER.filter((d) => this.owns(d.id));
  }

  /** レア度 → 限界突破 → 名簿順 */
  private byRank(defs: HostDef[]): HostDef[] {
    const idx = (d: HostDef) => HOST_ROSTER.indexOf(d);
    return [...defs].sort(
      (a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || this.limitBreak(b.id) - this.limitBreak(a.id) || idx(a) - idx(b),
    );
  }

  /** 同伴を受けていて、今日の出勤が確定しているホスト */
  pinnedHostIds(): Set<string> {
    return new Set(this.dohanOffers.filter((o) => o.status === "accepted" || o.status === "used").map((o) => o.hostId));
  }

  /** 同伴で出勤確定のホストを先頭にして、枠ぶんに切り詰める */
  private withPinned(candidates: HostDef[]): HostDef[] {
    const pinned = this.pinnedHostIds();
    const pins = this.byRank(this.ownedDefs().filter((d) => pinned.has(d.id)));
    const rest = this.byRank(candidates.filter((d) => !pinned.has(d.id)));
    return [...pins, ...rest].slice(0, this.tableCount);
  }

  /** 自動で選んだ場合の出勤メンバー（同伴の確定分＋レア度順にテーブル数ぶん） */
  autoRoster(): HostDef[] {
    return this.withPinned(this.ownedDefs());
  }

  /** 出勤メンバー。手動モードでは選んだ人だけ（枠を超えた分は切り捨て） */
  onFloorDefs(): HostDef[] {
    if (this.rosterMode === "auto") return this.autoRoster();
    return this.withPinned(HOST_ROSTER.filter((d) => this.owns(d.id) && this.manualRoster.includes(d.id)));
  }

  /** 手動の出勤メンバーを切り替える。枠が埋まっていれば追加しない。同伴で確定の人は外せない */
  toggleRoster(id: string): boolean {
    if (!this.owns(id) || this.pinnedHostIds().has(id)) return false;
    if (this.rosterMode === "auto") {
      this.rosterMode = "manual";
      this.manualRoster = this.autoRoster().map((d) => d.id);
    }
    const i = this.manualRoster.indexOf(id);
    if (i >= 0) {
      this.manualRoster.splice(i, 1);
      return true;
    }
    const used = new Set([...this.manualRoster.filter((x) => this.owns(x)), ...this.pinnedHostIds()]);
    if (used.size >= this.tableCount) return false;
    this.manualRoster.push(id);
    return true;
  }

  setRosterAuto(): void {
    this.rosterMode = "auto";
    this.manualRoster = [];
  }

  /** 開店時のスタミナ回復: 出勤者は少し、控えは多く */
  recoverStaminaForDay(onFloorIds: ReadonlySet<string>): void {
    for (const [id, h] of Object.entries(this.hosts)) {
      const gain = onFloorIds.has(id) ? STAMINA.recoverOnFloor : STAMINA.recoverBench;
      h.stamina = Math.min(STAMINA.max, h.stamina + gain);
    }
  }

  isCollected(r: Rarity): boolean {
    const all = HOST_ROSTER.filter((d) => d.rarity === r);
    return all.length > 0 && all.every((d) => this.owns(d.id));
  }
  collectionBonus(): number {
    let bonus = 0;
    for (const r of RARITIES) if (this.isCollected(r)) bonus += GACHA.collectionBonus[r] ?? 0;
    return bonus;
  }
  godOnFloor(): boolean {
    return this.onFloorDefs().some((d) => d.race === "神");
  }
  globalRevenueMultiplier(): number {
    return 1 + this.collectionBonus() + (this.godOnFloor() ? GACHA.godRevenueBonus : 0);
  }
  spawnFactor(): number {
    const carriage = 1 - CARRIAGE.perLevel * Math.min(this.upgrades.carriage, this.upgradeLimit("carriage"));
    return (this.godOnFloor() ? GACHA.godSpawnFactor : 1) * carriage;
  }

  // ---------- 太客 ----------

  regularsOf(hostId: string): Regular[] {
    return this.regulars.filter((r) => r.hostId === hostId);
  }

  /** 新しい太客を作る。ホストの上限に達していれば null */
  addRegular(type: CustomerType, hostId: string): Regular | null {
    if (this.regularsOf(hostId).length >= REGULAR.maxPerHost) return null;
    const id = this.nextRegularId++;
    const r: Regular = {
      id,
      name: regularName(type, id * 7 + this.day),
      type,
      hostId,
      affinity: REGULAR.initialAffinity,
      visits: 1,
      afterBoost: false,
    };
    this.regulars.push(r);
    return r;
  }

  removeRegular(id: number): void {
    this.regulars = this.regulars.filter((r) => r.id !== id);
  }

  // ---------- セーブ ----------

  toSave(): SaveData {
    return {
      v: SAVE.version,
      money: this.money,
      debt: this.debt,
      totalRevenue: this.totalRevenue,
      upgrades: { ...this.upgrades },
      shopLevel: this.shopLevel,
      hosts: structuredClone(this.hosts),
      pity: this.pity,
      totalPulls: this.totalPulls,
      day: this.day,
      clockMin: this.clockMin,
      phase: this.phase,
      negativeDays: this.negativeDays,
      rebirths: this.rebirths,
      recentSales: [...this.recentSales],
      lastReport: this.lastReport ? structuredClone(this.lastReport) : null,
      regulars: structuredClone(this.regulars),
      nextRegularId: this.nextRegularId,
      policy: this.policy,
      rosterMode: this.rosterMode,
      manualRoster: [...this.manualRoster],
      dohanOffers: structuredClone(this.dohanOffers),
      nextInvitationId: this.nextInvitationId,
      monthSales: { ...this.monthSales },
      monthDays: this.monthDays,
      no1HostId: this.no1HostId,
      savedAt: Date.now(),
    };
  }

  static fromSave(data: Partial<SaveData> & { v: number }): GameState {
    const s = new GameState();
    s.totalRevenue = num(data.totalRevenue);
    for (const key of Object.keys(s.upgrades) as UpgradeKey[]) {
      s.upgrades[key] = clampInt(num(data.upgrades?.[key]), 0, UPGRADES[key].max);
    }
    s.shopLevel = clampInt(num(data.shopLevel) || 1, 1, MAX_SHOP_LEVEL);
    s.pity = clampInt(num(data.pity), 0, GACHA.pity);
    s.totalPulls = clampInt(num(data.totalPulls), 0, Number.MAX_SAFE_INTEGER);

    if (data.v >= 3 && data.hosts && typeof data.hosts === "object") {
      for (const def of HOST_ROSTER) {
        const h = data.hosts[def.id] as Partial<OwnedHost> | undefined;
        if (h) {
          s.hosts[def.id] = {
            lb: clampInt(num(h.lb), 0, GACHA.limitBreakMax),
            stamina: h.stamina === undefined ? STAMINA.max : Math.max(0, Math.min(STAMINA.max, num(h.stamina))),
          };
        }
      }
    } else if (data.v === 2) {
      const scouted = clampInt(num((data.upgrades as Record<string, number> | undefined)?.host), 0, LEGACY_V2_SCOUT_ORDER.length);
      for (const id of LEGACY_V2_SCOUT_ORDER.slice(0, scouted)) s.hosts[id] = { lb: 0, stamina: STAMINA.max };
    }

    if (data.v >= 4) {
      s.money = num(data.money);
      s.debt = Math.max(0, num(data.debt));
      s.day = Math.max(1, clampInt(num(data.day) || 1, 1, Number.MAX_SAFE_INTEGER));
      s.clockMin = Math.max(0, num(data.clockMin));
      s.phase = isPhase(data.phase) ? data.phase : "preopen";
      s.negativeDays = clampInt(num(data.negativeDays), 0, LOAN.bankruptDays);
      s.rebirths = clampInt(num(data.rebirths), 0, 1000);
      s.recentSales = Array.isArray(data.recentSales) ? data.recentSales.map(num).slice(-30) : [];
      s.lastReport = data.lastReport && typeof data.lastReport === "object" ? (data.lastReport as DayReport) : null;
      // 閉店精算は済んでいるので、精算画面で終了した場合は翌日の開店前から
      if (s.phase === "closing") s.day += 1;
      if (s.phase === "open" || s.phase === "closing") {
        s.phase = "preopen";
        s.clockMin = 0;
      }
    } else {
      s.money = Math.max(num(data.money), startingCash(0));
      s.debt = LOAN.initialDebt;
    }

    if (data.v >= 5) {
      s.regulars = (Array.isArray(data.regulars) ? data.regulars : [])
        .filter((r) => r && s.owns(r.hostId) && CUSTOMER_TYPES.includes(r.type))
        .map((r) => ({
          id: clampInt(num(r.id), 1, Number.MAX_SAFE_INTEGER),
          name: String(r.name ?? "常連"),
          type: r.type,
          hostId: r.hostId,
          affinity: Math.max(1, Math.min(100, num(r.affinity))),
          visits: clampInt(num(r.visits), 0, Number.MAX_SAFE_INTEGER),
          afterBoost: r.afterBoost === true,
        }));
      s.nextRegularId = Math.max(clampInt(num(data.nextRegularId), 1, Number.MAX_SAFE_INTEGER), ...s.regulars.map((r) => r.id + 1), 1);
      s.policy = POLICIES.includes(data.policy as AssignPolicy) ? (data.policy as AssignPolicy) : "affinity";
      s.rosterMode = data.rosterMode === "manual" ? "manual" : "auto";
      s.manualRoster = Array.isArray(data.manualRoster) ? data.manualRoster.filter((id) => typeof id === "string" && s.owns(id)) : [];
    }

    if (data.v >= 6) {
      s.nextInvitationId = Math.max(1, clampInt(num(data.nextInvitationId), 1, Number.MAX_SAFE_INTEGER));
      // 精算画面で終了していた場合、前日の同伴はもう終わっている
      if (data.phase !== "closing" && Array.isArray(data.dohanOffers)) {
        s.dohanOffers = data.dohanOffers
          .filter((o) => o && o.kind === "dohan" && s.owns(o.hostId) && s.regulars.some((r) => r.id === o.regularId))
          .filter((o) => ["pending", "accepted", "declined", "used"].includes(o.status))
          .map((o) => ({
            id: clampInt(num(o.id), 1, Number.MAX_SAFE_INTEGER),
            kind: "dohan" as const,
            regularId: o.regularId,
            regularName: String(o.regularName ?? "常連"),
            hostId: o.hostId,
            status: o.status,
          }));
      }
    }
    if (data.v >= 7) {
      if (data.monthSales && typeof data.monthSales === "object") {
        for (const [id, v] of Object.entries(data.monthSales)) if (s.owns(id)) s.monthSales[id] = Math.max(0, num(v));
      }
      s.monthDays = clampInt(num(data.monthDays), 0, MONTHLY.days);
      s.no1HostId = typeof data.no1HostId === "string" && s.owns(data.no1HostId) ? data.no1HostId : null;
    }
    return s;
  }
}

function isPhase(v: unknown): v is DayPhase {
  return v === "preopen" || v === "open" || v === "closing" || v === "bankrupt";
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

// --- 永続化（localStorage。Tauri でも WebView のデータ領域に残る） ---

function parseSave(raw: string | null): (Partial<SaveData> & { v: number }) | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (typeof data !== "object" || data === null || typeof data.v !== "number") return null;
    if (data.v < 2 || data.v > SAVE.version) return null;
    return data as Partial<SaveData> & { v: number };
  } catch {
    return null;
  }
}

/** セーブを読む。壊れていたら直前のバックアップから復旧する */
export function loadSave(): (Partial<SaveData> & { v: number }) | null {
  try {
    return parseSave(localStorage.getItem(SAVE.key)) ?? parseSave(localStorage.getItem(SAVE.backupKey));
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): boolean {
  try {
    // 読めるセーブだけをバックアップに回す（壊れたデータで上書きしない）
    const current = localStorage.getItem(SAVE.key);
    if (current && parseSave(current)) localStorage.setItem(SAVE.backupKey, current);
    localStorage.setItem(SAVE.key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE.key);
    localStorage.removeItem(SAVE.backupKey);
  } catch {
    /* noop */
  }
}
