import { INVITE, STAMINA } from "./data/customers";
import { HOST_WAGE } from "./data/economy";
import type { GameState, Invitation, Regular } from "./state";

/**
 * 同伴・アフターの誘い。要件定義書 §10.9。
 * どちらも1ホスト1日1件まで受けられ、断ると好感度が下がる。
 */
type Rng = () => number;

export function dohanFee(shopLevel: number): number {
  return INVITE.dohanFeeBase * (HOST_WAGE.guaranteeScaleByShop[shopLevel] ?? 1);
}

function makeOffers(
  state: GameState,
  kind: Invitation["kind"],
  regulars: readonly Regular[],
  chance: (r: Regular) => number,
  rng: Rng,
): Invitation[] {
  const perHost = new Map<string, number>();
  const offers: Invitation[] = [];
  // 好感度の高い太客から誘う
  for (const r of [...regulars].sort((a, b) => b.affinity - a.affinity)) {
    const n = perHost.get(r.hostId) ?? 0;
    if (n >= INVITE.perHostMax || rng() >= chance(r)) continue;
    perHost.set(r.hostId, n + 1);
    offers.push({ id: state.nextInvitationId++, kind, regularId: r.id, regularName: r.name, hostId: r.hostId, status: "pending" });
  }
  return offers;
}

/** 閉店時のアフターの誘い: その日に指名ホストの接客を受けた太客から */
export function generateAfterOffers(state: GameState, regularIds: readonly number[], rng: Rng = Math.random): Invitation[] {
  const ids = new Set(regularIds);
  return makeOffers(
    state,
    "after",
    state.regulars.filter((r) => ids.has(r.id)),
    (r) => INVITE.afterChanceBase + r.affinity * INVITE.afterChancePerAffinity,
    rng,
  );
}

/** 翌日の同伴の誘い: 好感度が一定以上の太客から */
export function generateDohanOffers(state: GameState, rng: Rng = Math.random): Invitation[] {
  return makeOffers(
    state,
    "dohan",
    state.regulars.filter((r) => r.affinity >= INVITE.dohanMinAffinity),
    (r) => INVITE.dohanChanceBase + r.affinity * INVITE.dohanChancePerAffinity,
    rng,
  );
}

function offersOf(state: GameState, kind: Invitation["kind"]): Invitation[] {
  return kind === "after" ? state.afterOffers : state.dohanOffers;
}

function regularOf(state: GameState, inv: Invitation): Regular | undefined {
  return state.regulars.find((r) => r.id === inv.regularId);
}

/** 受けられない理由。受けられるなら null */
export function acceptBlockReason(state: GameState, inv: Invitation): string | null {
  if (inv.status !== "pending") return "回答済み";
  if (!regularOf(state, inv)) return "店を離れました";
  if (inv.kind === "dohan") {
    const accepted = state.dohanOffers.filter((o) => o.status === "accepted").length;
    if (accepted >= state.tableCount) return "同伴は卓数までです";
  }
  return null;
}

export function acceptInvitation(state: GameState, inv: Invitation): boolean {
  if (acceptBlockReason(state, inv) !== null) return false;
  inv.status = "accepted";
  if (inv.kind === "after") {
    const r = regularOf(state, inv);
    if (r) {
      r.affinity = Math.min(100, r.affinity + INVITE.afterAffinityGain);
      r.afterBoost = true;
    }
    const h = state.hosts[inv.hostId];
    if (h) h.stamina = Math.max(0, h.stamina - INVITE.afterStamina);
  }
  // 同じホストへの他の誘いは受けられないので断る
  for (const o of offersOf(state, inv.kind)) {
    if (o !== inv && o.hostId === inv.hostId && o.status === "pending") declineInvitation(state, o);
  }
  return true;
}

export function declineInvitation(state: GameState, inv: Invitation): void {
  if (inv.status !== "pending") return;
  inv.status = "declined";
  const r = regularOf(state, inv);
  if (!r) return;
  r.affinity = Math.max(0, r.affinity - INVITE.declineAffinity);
  if (r.affinity <= 0) state.removeRegular(r.id);
}

export function pendingCount(offers: readonly Invitation[]): number {
  return offers.filter((o) => o.status === "pending").length;
}

export function declineAllPending(state: GameState, offers: readonly Invitation[]): void {
  for (const o of offers) declineInvitation(state, o);
}

/** 開店時: 同伴を受けたホストは開店前から働くのでスタミナが減る */
export function applyDohanStamina(state: GameState): void {
  for (const o of state.dohanOffers) {
    if (o.status !== "accepted") continue;
    const h = state.hosts[o.hostId];
    if (h) h.stamina = Math.max(0, Math.min(STAMINA.max, h.stamina - INVITE.dohanStamina));
  }
}
