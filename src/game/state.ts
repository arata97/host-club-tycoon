import { SAVE, UPGRADES, type UpgradeKey, upgradeCost } from "./data/balance";

/** セーブに含める永続データ。エンティティの瞬間的な位置などは含めない。 */
export interface SaveData {
  v: number;
  money: number;
  totalRevenue: number;
  upgrades: Record<UpgradeKey, number>;
  savedAt: number;
}

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
    host: 0,
  };

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
  get hostCount(): number {
    return this.upgrades.host;
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

  toSave(): SaveData {
    return {
      v: SAVE.version,
      money: this.money,
      totalRevenue: this.totalRevenue,
      upgrades: { ...this.upgrades },
      savedAt: Date.now(),
    };
  }

  static fromSave(data: SaveData): GameState {
    const s = new GameState();
    s.money = Number(data.money) || 0;
    s.totalRevenue = Number(data.totalRevenue) || 0;
    for (const key of Object.keys(s.upgrades) as UpgradeKey[]) {
      const n = Number(data.upgrades?.[key]) || 0;
      s.upgrades[key] = Math.max(0, Math.min(UPGRADES[key].max, Math.floor(n)));
    }
    return s;
  }
}

// --- 永続化（フェーズ1は localStorage。Tauri fs への切替はフェーズ4） ---

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE.key);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (typeof data !== "object" || data === null) return null;
    // 旧バージョンのセーブは互換性がないため破棄（開発初期のみ）
    if (data.v !== SAVE.version) return null;
    return data as SaveData;
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
