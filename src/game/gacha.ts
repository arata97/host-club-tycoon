import { GACHA, gachaPrice, gachaRates, pityRarity, RARITIES, type Rarity, rarityRank } from "./data/balance";
import { HOST_ROSTER, type HostDef } from "./data/hosts";
import type { GameState } from "./state";

export type Rng = () => number;

export interface PullResult {
  def: HostDef;
  isNew: boolean;
  /** 付与後の限界突破段階 */
  limitBreak: number;
  /** 限界突破MAXで被ったときの返金額（それ以外は 0） */
  refund: number;
  /** 天井で確定した排出か */
  pityHit: boolean;
}

/** その店舗レベルでガチャから出るホスト（累積式。UR は常に含む） */
export function gachaPool(shopLevel: number): HostDef[] {
  return HOST_ROSTER.filter((h) => h.rarity === "UR" || h.unlockShop <= shopLevel);
}

export function rollRarity(shopLevel: number, rng: Rng): Rarity {
  const rates = gachaRates(shopLevel);
  let r = rng() * 100;
  for (const rarity of RARITIES) {
    r -= rates[rarity];
    if (r < 0) return rarity;
  }
  return "N";
}

/** 指定レア度のホストをプールから1人選ぶ。該当者がいなければ1段下げる */
function pickHost(shopLevel: number, rarity: Rarity, rng: Rng): HostDef {
  const pool = gachaPool(shopLevel);
  for (let rank = rarityRank(rarity); rank >= 0; rank--) {
    const candidates = pool.filter((h) => rarityRank(h.rarity) === rank);
    const pick = candidates[Math.floor(rng() * candidates.length)];
    if (pick) return pick;
  }
  const fallback = pool[0];
  if (!fallback) throw new Error("ガチャのプールが空です");
  return fallback;
}

export function canPull(state: GameState, multi: boolean): boolean {
  return state.money >= gachaPrice(state.shopLevel, multi);
}

/** ガチャを引く。所持金不足なら null。所持金の減算・ホスト付与・天井更新まで行う */
export function pull(state: GameState, multi: boolean, rng: Rng = Math.random): PullResult[] | null {
  const cost = gachaPrice(state.shopLevel, multi);
  if (state.money < cost) return null;
  state.money -= cost;
  const n = multi ? GACHA.multiCount : 1;
  const results: PullResult[] = [];
  for (let i = 0; i < n; i++) results.push(pullOne(state, rng));
  return results;
}

function pullOne(state: GameState, rng: Rng): PullResult {
  state.totalPulls += 1;
  state.pity += 1;

  const pityTarget = pityRarity(state.shopLevel);
  let rarity = rollRarity(state.shopLevel, rng);
  let pityHit = false;
  if (rarityRank(rarity) < rarityRank(pityTarget) && state.pity >= GACHA.pity) {
    rarity = pityTarget;
    pityHit = true;
  }
  const def = pickHost(state.shopLevel, rarity, rng);
  if (rarityRank(def.rarity) >= rarityRank(pityTarget)) state.pity = 0;

  const owned = state.hosts[def.id];
  if (!owned) {
    state.hosts[def.id] = { lb: 0, stamina: 100 };
    return { def, isNew: true, limitBreak: 0, refund: 0, pityHit };
  }
  if (owned.lb < GACHA.limitBreakMax) {
    owned.lb += 1;
    return { def, isNew: false, limitBreak: owned.lb, refund: 0, pityHit };
  }
  // 限界突破MAX: 単発価格の半額を返金（売上には含めない）
  const refund = Math.floor(gachaPrice(state.shopLevel, false) / 2);
  state.money += refund;
  return { def, isNew: false, limitBreak: owned.lb, refund, pityHit };
}

/** 天井まであと何回か */
export function pullsUntilPity(state: GameState): number {
  return Math.max(0, GACHA.pity - state.pity);
}
