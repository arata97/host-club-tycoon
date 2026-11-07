import { GACHA, RARITIES, type Rarity, rarityRank, SAVE, UPGRADES, type UpgradeKey, upgradeCost } from "./data/balance";
import { HOST_ROSTER, type HostDef } from "./data/hosts";

export interface OwnedHost {
  /** 限界突破段階（0〜GACHA.limitBreakMax） */
  lb: number;
}

/** セーブに含める永続データ。エンティティの瞬間的な位置などは含めない。 */
export interface SaveData {
  v: number;
  money: number;
  totalRevenue: number;
  upgrades: Record<UpgradeKey, number>;
  shopLevel: number;
  hosts: Record<string, OwnedHost>;
  /** 天井カウンター（天井対象レア度以上が出てからの連数） */
  pity: number;
  totalPulls: number;
  savedAt: number;
}

/** v2 セーブの「スカウト人数」を v3 の所持ホストに移行するときの順序 */
const LEGACY_V2_SCOUT_ORDER = ["ren", "kakeru", "yuu", "garon", "rio", "rui"];

export class GameState {
  money = 0;
  totalRevenue = 0;
  /** 各アップグレードの購入回数 */
  upgrades: Record<UpgradeKey, number> = {
    table: 0,
    cellar: 0,
    speed: 0,
    carry: 0,
    staff: 0,
    staffLv: 0,
  };
  /** 現在の店舗（1〜5）。店舗解放はフェーズ3 */
  shopLevel = 1;
  /** 所持ホスト（id → 限界突破段階） */
  hosts: Record<string, OwnedHost> = {};
  pity = 0;
  totalPulls = 0;

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
  /** 購入を試みる。成功したら true */
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

  /**
   * 出勤するホスト。所持ホストのうち「レア度 → 限界突破 → 名簿順」で上位から、
   * テーブル数ぶんだけ。残りは控え。
   */
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

  /** そのレア度のホストを全員所持しているか */
  isCollected(r: Rarity): boolean {
    const all = HOST_ROSTER.filter((d) => d.rarity === r);
    return all.length > 0 && all.every((d) => this.owns(d.id));
  }
  /** 図鑑コンプによる全売上ボーナス（加算） */
  collectionBonus(): number {
    let bonus = 0;
    for (const r of RARITIES) if (this.isCollected(r)) bonus += GACHA.collectionBonus[r] ?? 0;
    return bonus;
  }
  godOnFloor(): boolean {
    return this.onFloorDefs().some((d) => d.race === "神");
  }
  /** 全売上にかかる倍率（図鑑コンプ＋神の出勤） */
  globalRevenueMultiplier(): number {
    return 1 + this.collectionBonus() + (this.godOnFloor() ? GACHA.godRevenueBonus : 0);
  }
  /** 来店間隔にかかる係数 */
  spawnFactor(): number {
    return this.godOnFloor() ? GACHA.godSpawnFactor : 1;
  }

  // ---------- セーブ ----------

  toSave(): SaveData {
    return {
      v: SAVE.version,
      money: this.money,
      totalRevenue: this.totalRevenue,
      upgrades: { ...this.upgrades },
      shopLevel: this.shopLevel,
      hosts: structuredClone(this.hosts),
      pity: this.pity,
      totalPulls: this.totalPulls,
      savedAt: Date.now(),
    };
  }

  static fromSave(data: Partial<SaveData> & { v: number }): GameState {
    const s = new GameState();
    s.money = num(data.money);
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
      // v2: ショップでスカウトした人数ぶん、名簿の先頭から所持扱いにする
      const scouted = clampInt(num((data.upgrades as Record<string, number> | undefined)?.host), 0, LEGACY_V2_SCOUT_ORDER.length);
      for (const id of LEGACY_V2_SCOUT_ORDER.slice(0, scouted)) s.hosts[id] = { lb: 0 };
    }
    return s;
  }
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
    // v2 以降は移行可能。v1 は互換性なし
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
