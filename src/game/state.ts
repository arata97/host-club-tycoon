import { GACHA, RARITIES, type Rarity, rarityRank, SAVE, UPGRADES, type UpgradeKey, upgradeCost } from "./data/balance";
import { LOAN, startingCash } from "./data/economy";
import { HOST_ROSTER, type HostDef } from "./data/hosts";
import type { DayReport } from "./ledger";

export interface OwnedHost {
  /** 限界突破段階（0〜GACHA.limitBreakMax） */
  lb: number;
}

/** 1日の中の状態。preopen=開店前（時間停止）、open=営業中、closing=閉店精算、bankrupt=倒産画面 */
export type DayPhase = "preopen" | "open" | "closing" | "bankrupt";

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
  savedAt: number;
}

/** v2 セーブの「スカウト人数」を v3 の所持ホストに移行するときの順序 */
const LEGACY_V2_SCOUT_ORDER = ["ren", "kakeru", "yuu", "garon", "rio", "rui"];

export class GameState {
  /** 現金 */
  money = startingCash(0);
  debt: number = LOAN.initialDebt;
  totalRevenue = 0;
  upgrades: Record<UpgradeKey, number> = {
    table: 0,
    cellar: 0,
    speed: 0,
    carry: 0,
    staff: 0,
    staffLv: 0,
  };
  /** 現在の店舗（1〜5）。店舗解放はフェーズ3d */
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

  // ---------- 店舗 ----------

  get tableCount(): number {
    return 1 + this.upgrades.table;
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
    return this.upgrades[key] >= UPGRADES[key].max;
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
  /** いま追加で借りられる額（上限 − 残高） */
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

  /** 倒産 → 再転生。図鑑・天井・転生回数を引き継ぎ、店と金はリセット */
  reincarnate(): void {
    const keep = { hosts: this.hosts, pity: this.pity, totalPulls: this.totalPulls, rebirths: this.rebirths + 1, totalRevenue: this.totalRevenue };
    const fresh = new GameState();
    Object.assign(this, fresh);
    this.hosts = keep.hosts;
    this.pity = keep.pity;
    this.totalPulls = keep.totalPulls;
    this.rebirths = keep.rebirths;
    this.totalRevenue = keep.totalRevenue;
    this.money = startingCash(this.rebirths);
  }

  // ---------- ホスト ----------

  owns(id: string): boolean {
    return this.hosts[id] !== undefined;
  }
  limitBreak(id: string): number {
    return this.hosts[id]?.lb ?? 0;
  }
  ownedDefs(): HostDef[] {
    return HOST_ROSTER.filter((d) => this.owns(d.id));
  }
  onFloorDefs(): HostDef[] {
    return HOST_ROSTER.map((d, i) => ({ d, i }))
      .filter(({ d }) => this.owns(d.id))
      .sort(
        (a, b) =>
          rarityRank(b.d.rarity) - rarityRank(a.d.rarity) || this.limitBreak(b.d.id) - this.limitBreak(a.d.id) || a.i - b.i,
      )
      .slice(0, this.tableCount)
      .map(({ d }) => d);
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
    return this.godOnFloor() ? GACHA.godSpawnFactor : 1;
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
      savedAt: Date.now(),
    };
  }

  static fromSave(data: Partial<SaveData> & { v: number }): GameState {
    const s = new GameState();
    s.totalRevenue = num(data.totalRevenue);
    for (const key of Object.keys(s.upgrades) as UpgradeKey[]) {
      s.upgrades[key] = clampInt(num(data.upgrades?.[key]), 0, UPGRADES[key].max);
    }
    s.shopLevel = clampInt(num(data.shopLevel) || 1, 1, 5);
    s.pity = clampInt(num(data.pity), 0, GACHA.pity);
    s.totalPulls = clampInt(num(data.totalPulls), 0, Number.MAX_SAFE_INTEGER);

    if (data.v >= 3 && data.hosts && typeof data.hosts === "object") {
      for (const def of HOST_ROSTER) {
        const h = data.hosts[def.id];
        if (h) s.hosts[def.id] = { lb: clampInt(num(h.lb), 0, GACHA.limitBreakMax) };
      }
    } else if (data.v === 2) {
      const scouted = clampInt(num((data.upgrades as Record<string, number> | undefined)?.host), 0, LEGACY_V2_SCOUT_ORDER.length);
      for (const id of LEGACY_V2_SCOUT_ORDER.slice(0, scouted)) s.hosts[id] = { lb: 0 };
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
      // 営業中・精算中に保存されたデータは、開店前からやり直す（時刻は捨てる）
      if (s.phase === "open" || s.phase === "closing") {
        s.phase = "preopen";
        s.clockMin = 0;
      }
    } else {
      // v2/v3 → v4: 営業日の概念がなかったので、開業資金を借りた状態の Day 1 開店前にする
      s.money = Math.max(num(data.money), startingCash(0));
      s.debt = LOAN.initialDebt;
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

// --- 永続化（localStorage。Tauri fs への切替はフェーズ4） ---

export function loadSave(): (Partial<SaveData> & { v: number }) | null {
  try {
    const raw = localStorage.getItem(SAVE.key);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (typeof data !== "object" || data === null || typeof data.v !== "number") return null;
    if (data.v < 2 || data.v > SAVE.version) return null;
    return data as Partial<SaveData> & { v: number };
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): boolean {
  try {
    localStorage.setItem(SAVE.key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE.key);
  } catch {
    /* noop */
  }
}
