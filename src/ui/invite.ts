import { INVITE } from "../game/data/customers";
import { hostById } from "../game/data/hosts";
import { acceptBlockReason, acceptInvitation, declineInvitation, dohanFee } from "../game/invitations";
import type { GameState, Invitation } from "../game/state";
import { formatG } from "../game/util";

/** 同伴・アフターの誘いのカード。閉店画面と経営画面で共用 */
export function renderInviteCard(state: GameState, inv: Invitation, onChange: () => void): HTMLElement {
  const def = hostById(inv.hostId);
  const regular = state.regulars.find((r) => r.id === inv.regularId);
  const stamina = Math.round(state.stamina(inv.hostId));

  const card = document.createElement("div");
  card.className = `invite-card ${inv.status}`;

  const info = document.createElement("div");
  info.className = "invite-info";
  const title = document.createElement("div");
  title.className = "invite-title";
  title.textContent = `${inv.regularName}${regular ? `（${regular.type}・♥${Math.round(regular.affinity)}）` : ""} → ${def?.name ?? "?"}`;
  const effect = document.createElement("div");
  effect.className = "invite-effect";
  effect.textContent =
    inv.kind === "after"
      ? `好感度+${INVITE.afterAffinityGain}・次回は来店しやすく予算+${Math.round(INVITE.afterBudgetBonus * 100)}%／${def?.name ?? "ホスト"}のスタミナ −${INVITE.afterStamina}（いま ${stamina}）`
      : `開店と同時に来店確定・同伴料 +${formatG(dohanFee(state.shopLevel))}・予算+${Math.round(INVITE.dohanBudgetBonus * 100)}%／${def?.name ?? "ホスト"}は出勤確定、スタミナ −${INVITE.dohanStamina}`;
  info.append(title, effect);
  card.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "invite-actions";
  if (inv.status === "pending") {
    const reason = acceptBlockReason(state, inv);
    const accept = document.createElement("button");
    accept.type = "button";
    accept.className = "btn-gold";
    accept.textContent = "受ける";
    accept.disabled = reason !== null;
    if (reason) accept.title = reason;
    accept.addEventListener("click", () => {
      if (acceptInvitation(state, inv)) onChange();
    });
    const decline = document.createElement("button");
    decline.type = "button";
    decline.className = "btn-ghost";
    decline.textContent = `断る（♥−${INVITE.declineAffinity}）`;
    decline.addEventListener("click", () => {
      declineInvitation(state, inv);
      onChange();
    });
    actions.append(accept, decline);
  } else {
    const st = document.createElement("span");
    st.className = "invite-status";
    if (inv.status === "accepted" || inv.status === "used") st.textContent = "受けた";
    else st.textContent = regular ? "断った" : "断った（店を離れた）";
    actions.appendChild(st);
  }
  card.appendChild(actions);
  return card;
}
