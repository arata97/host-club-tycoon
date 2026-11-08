import { gachaPrice, RARITIES, type Rarity, UPGRADES, type UpgradeKey } from "../game/data/balance";
import { hostGuaranteeFor, LOAN, rentFor, staffWageFor } from "../game/data/economy";
import { HOST_ROSTER } from "../game/data/hosts";
import { gachaPool, pull } from "../game/gacha";
import type { Game } from "../game/game";
import { acceptBlockReason, acceptInvitation, declineAllPending } from "../game/invitations";
import type { GameState, Invitation } from "../game/state";
import type { World } from "../game/world";

/**
 * バランス調整用の自動プレイ（開発専用。本番のバンドルには含まれない）。
 * ブラウザのコンソールから:
 *   const { runAutoplay } = await import("/src/dev/autoplay.ts");
 *   const r = await runAutoplay(window.__game, { days: 150 });
 *
 * 「普通に遊ぶプレイヤー」を想定する: 配膳は最寄りの卓から、買い物は安いものから、
 * 移転できるようになったら資金を貯めて移転する。最適化はしない。
 */

export interface AutoplayOptions {
  days: number;
  /** 1ステップのゲーム内分（＝秒） */
  dt?: number;
}

export interface DaySample {
  day: number;
  shop: number;
  sales: number;
  net: number;
  money: number;
  debt: number;
  seats: number;
  cellar: number;
  owned: Partial<Record<Rarity, number>>;
  customers: number;
  walkouts: number;
}

export interface AutoplayResult {
  /** 各店舗に初めて移転した日（Day） */
  shopDay: Record<number, number>;
  /** 図鑑コンプの日 */
  completeDay: number | null;
  bankruptcies: number;
  /** 現金がマイナスで閉店した日数 */
  negativeDays: number;
  samples: DaySample[];
}

type Vec = { x: number; y: number };

function steer(world: World): Vec {
  const p = world.player;
  const toward = (x: number, y: number): Vec => {
    const dx = x - p.x;
    const dy = y - p.y;
    const len = Math.hypot(dx, dy);
    return len < 3 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len };
  };
  const nearest = (cond: (t: World["tables"][number]) => boolean) => {
    let best: World["tables"][number] | null = null;
    let bestD = Infinity;
    for (const t of world.tables) {
      if (!cond(t)) continue;
      const d = Math.hypot(t.serveX - p.x, t.serveY - p.y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  };
  const checkout = nearest((t) => t.customer?.phase === "checkout");
  if (p.carrying > 0) {
    const t = nearest((x) => x.needsService && !x.claimedBy) ?? nearest((x) => x.needsService);
    if (t) return toward(t.serveX, t.serveY);
  }
  if (checkout && !world.tables.some((t) => t.needsService && !t.claimedBy)) return toward(checkout.serveX, checkout.serveY);
  return toward(world.cellar.interactX, world.cellar.interactY);
}

/** 2日分の固定費。これを割らないように買い物する */
function reserveFor(s: GameState, shopLevel: number): number {
  const guarantees = s.onFloorDefs().reduce((a, d) => a + hostGuaranteeFor(d.rarity, shopLevel), 0);
  const wages = staffWageFor(s.staffLevel) * s.staffCount;
  return (rentFor(shopLevel) + guarantees + wages + s.debt * LOAN.dailyRate) * 2;
}

const UPGRADE_KEYS = Object.keys(UPGRADES) as UpgradeKey[];

function shop(s: GameState, onChange: () => void): void {
  const next = s.nextShop;
  const recent = s.recentSales.slice(-3);
  const avgSales = recent.reduce((a, v) => a + v, 0) / Math.max(1, recent.length);
  // 今の売上で新しい家賃を払えるようになってから移転する
  if (next && s.relocationBlock() === null && avgSales >= rentFor(next.level) * 1.5) {
    if (s.money >= next.moveCost + reserveFor(s, next.level)) {
      s.relocate();
      onChange();
    } else {
      // 移転の資金を貯める
      return;
    }
  }
  for (let guard = 0; guard < 300; guard++) {
    const reserve = reserveFor(s, s.shopLevel);
    const single = gachaPrice(s.shopLevel, false);
    const wantHosts = s.ownedDefs().length < s.tableCount;
    const missing = gachaPool(s.shopLevel).some((d) => d.rarity !== "UR" && !s.owns(d.id));
    const options = UPGRADE_KEYS.filter((k) => !s.isMaxed(k)).map((k) => ({ cost: s.costOf(k), key: k as UpgradeKey | "gacha" }));
    // 席が空くほどホストが足りないときは最優先。未入手がいるときと、設備を買い切ったときも引く
    if (wantHosts) options.unshift({ cost: single, key: "gacha" });
    else options.sort((a, b) => a.cost - b.cost);
    if (!wantHosts && (options.length === 0 || (missing && single * 3 <= s.money - reserve && s.seatCount("general") >= Math.min(3, s.shop.seats.general)) || single * 30 <= s.money - reserve)) {
      options.unshift({ cost: single, key: "gacha" });
    }
    const pick = options[0];
    if (!pick || s.money - pick.cost < reserve) return;
    if (pick.key === "gacha") {
      const multi = gachaPrice(s.shopLevel, true);
      pull(s, s.money - multi >= reserve && !wantHosts);
    } else s.buy(pick.key);
    onChange();
  }
}

function answer(s: GameState, offers: Invitation[]): void {
  for (const inv of offers) {
    if (inv.status === "pending" && s.stamina(inv.hostId) >= 50 && acceptBlockReason(s, inv) === null) acceptInvitation(s, inv);
  }
  declineAllPending(s, offers);
}

function ownedByRarity(s: GameState): Partial<Record<Rarity, number>> {
  const out: Partial<Record<Rarity, number>> = {};
  for (const r of RARITIES) out[r] = s.ownedDefs().filter((d) => d.rarity === r).length;
  return out;
}

export async function runAutoplay(game: Game, opts: AutoplayOptions): Promise<AutoplayResult> {
  const dt = opts.dt ?? 1 / 20;
  const s = game.state;
  const g = game as unknown as { input: { axis: () => Vec } };
  const originalAxis = g.input.axis.bind(g.input);
  g.input.axis = () => steer(game.world);

  const result: AutoplayResult = { shopDay: { 1: s.day }, completeDay: null, bankruptcies: 0, negativeDays: 0, samples: [] };
  const onChange = () => game.world.syncWithState();

  try {
    for (let played = 0; played < opts.days; played++) {
      if (s.phase === "preopen") {
        answer(s, s.dohanOffers);
        if (s.money < 0) s.borrow(Math.min(s.borrowable(), Math.ceil(-s.money)));
        const before = s.shopLevel;
        shop(s, onChange);
        if (s.shopLevel !== before) result.shopDay[s.shopLevel] = s.day;
        if (s.debt > 0) {
          const spare = s.money - reserveFor(s, s.shopLevel) * 2;
          if (spare > 0 && s.relocationBlock() !== null) s.repay(Math.min(spare, s.debt));
        }
        game.closeAllPanels();
        game.openDay();
      }
      while (s.phase === "open") game.update(dt);

      if (s.phase === "bankrupt") {
        result.bankruptcies += 1;
        game.reincarnate();
        result.shopDay = { 1: s.day };
        continue;
      }

      const r = s.lastReport;
      if (r) {
        if (r.cashAfter < 0) result.negativeDays += 1;
        result.samples.push({
          day: r.day,
          shop: s.shopLevel,
          sales: r.sales,
          net: r.net,
          money: Math.round(s.money),
          debt: Math.round(s.debt),
          seats: s.tableCount,
          cellar: s.cellarLevel,
          owned: ownedByRarity(s),
          customers: r.customers,
          walkouts: r.walkouts,
        });
      }
      if (result.completeDay === null && HOST_ROSTER.every((d) => s.owns(d.id))) result.completeDay = s.day;
      answer(s, s.afterOffers);
      game.nextDay();
      // ブラウザを固めないよう、ときどき制御を返す（非表示のタブではタイマーが間引かれる）
      if (played % 60 === 59) await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    g.input.axis = originalAxis;
  }
  return result;
}

/** 結果を10日刻みの表にする */
export function summarize(r: AutoplayResult, every = 10): string {
  const rows = r.samples
    .filter((x, i) => i === 0 || x.day % every === 0)
    .map((x) => {
      const o = RARITIES.map((k) => x.owned[k] ?? 0).join("/");
      return `D${x.day} 店${x.shop} 席${x.seats} 蔵${x.cellar} 客${x.customers}(逃${x.walkouts}) 売${fmt(x.sales)} 純${fmt(x.net)} 金${fmt(x.money)} 借${fmt(x.debt)} [${o}]`;
    });
  return `店舗到達: ${JSON.stringify(r.shopDay)} 図鑑コンプ: ${r.completeDay} 倒産: ${r.bankruptcies} 赤字閉店: ${r.negativeDays}\n${rows.join("\n")}`;
}

function fmt(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e8) return `${sign}${(a / 1e8).toFixed(1)}億`;
  if (a >= 1e4) return `${sign}${Math.round(a / 1e4)}万`;
  return `${sign}${Math.round(a)}`;
}
