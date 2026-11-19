import { MEMBER } from "@/lib/kanban/view";
import type { Actor } from "@/lib/kanban/types";
import { dealHistory } from "./actions";
import { DEAL_TYPE_LABEL, type Deal, type DealType } from "./types";

// Read-side helpers for the Deals UI (handoff §3.3). Stage chip colours, money formatting and the
// history panel lines with Revert on every Claude or Duet change (§5.4).

export function formatMoney(n: number | null): string {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-US")}`;
}

export function formatProbability(p: number | null): string {
  return p == null ? "—" : `${p}%`;
}

// Stage chip colours from the mockup (Deals.dc.html): warm for Sale, cool for Development.
export const TYPE_CHIP: Record<DealType, { bg: string; ink: string }> = {
  sale: { bg: "#FCE7DA", ink: "#7C2D12" },
  development: { bg: "#E7EAF1", ink: "#273246" },
};

export function typeLabel(t: DealType): string {
  return DEAL_TYPE_LABEL[t];
}

export type DealHistoryLine = {
  id: number;
  actor: Actor;
  text: string;
  when: string;
  revertable: boolean;
};

function changedList(fields: Record<string, unknown> | null): string {
  if (!fields) return "";
  const names: Record<string, string> = {
    name: "name",
    type: "type",
    stage: "stage",
    value: "value",
    probability: "probability",
    currentTask: "current task",
    nextAction: "next action",
    nextActionDate: "next action date",
    notes: "notes",
    boards: "boards",
    customerId: "customer",
    jobId: "EZ Binder job",
    archivedAt: "archive",
  };
  return Object.keys(fields)
    .map((k) => names[k] ?? k)
    .join(", ");
}

function actionText(actor: Actor, action: string, after: Record<string, unknown> | null): string {
  const who = MEMBER[actor]?.label ?? actor;
  switch (action) {
    case "create":
      return `${who} created the deal`;
    case "archive":
      return `${who} archived the deal`;
    case "restore":
      return `${who} restored the deal`;
    case "revert":
      return `${who} reverted a change`;
    default: {
      const what = changedList(after);
      return what ? `${who} changed the ${what}` : `${who} edited the deal`;
    }
  }
}

// The history panel for a deal, newest first (handoff §3.3). Revert is offered on every Claude or
// Duet change (§5.4), except a revert line itself.
export function dealHistoryLines(dealId: number): DealHistoryLine[] {
  return dealHistory(dealId)
    .map((c) => ({
      id: c.id,
      actor: c.actor,
      text: actionText(c.actor, c.action, c.after),
      when: c.at,
      revertable: (c.actor === "claude" || c.actor === "duet") && c.action !== "revert",
    }))
    .reverse();
}

// Filter deals to a board (handoff §1.3, spec check 5: the board toggle filters deals by their
// boards list). A deal shows on every board it lists.
export function dealsOnBoard(deals: Deal[], board: string): Deal[] {
  return deals.filter((d) => d.boards.includes(board as never));
}
