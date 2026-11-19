import "server-only";
import { listCards } from "./store";
import { listProblems } from "./state";
import { readEntries } from "./activity";
import { loadConfig } from "./boardyaml";
import { contextFile } from "./paths";
import { daysBetween } from "./time";
import { STAGES, COLUMN_DEFS, type Board, type Card, type Stage, type Actor } from "./types";

// Read-side helpers for the kanban UI (handoff §3.1). Filtering by board, area and project; the
// column layout; and the card detail with its history.

export const COLUMNS = COLUMN_DEFS;

export type BoardFilters = { board: Board; area?: string; project?: string };

export type ColumnView = { stage: Stage; name: string; hint: string; cards: Card[]; count: number };

// Build the five columns for a board (handoff §3.1). Discarded cards are hidden from the board;
// Done shows the last 7 days. Area and project narrow the set. Sorted by order within a column.
export function getBoardView(filters: BoardFilters, now: string): ColumnView[] {
  const all = listCards().filter((c) => {
    if (c.stage === "discarded") return false;
    if (!c.boards.includes(filters.board)) return false;
    if (filters.area && filters.area !== "all" && c.area !== filters.area) return false;
    if (filters.project && filters.project !== "all" && c.project !== filters.project) return false;
    if (c.stage === "done" && c.done_at && daysBetween(now, c.done_at) > 7) return false;
    return true;
  });
  return COLUMNS.map((col) => {
    const cards = all
      .filter((c) => c.stage === col.stage)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    return { ...col, cards, count: cards.length };
  });
}

export function problemsCount(): number {
  return listProblems().length;
}

export function projectOptions(): { slug: string; name: string }[] {
  return loadConfig().projects.map((p) => ({ slug: p.slug, name: p.name }));
}

// The named members shown wherever a change is attributed (handoff §3.1).
export const MEMBER: Record<Actor, { label: string; letter: string; color: string }> = {
  josh: { label: "Josh", letter: "J", color: "#16181D" },
  christine: { label: "Christine", letter: "C", color: "#2F5BD3" },
  claude: { label: "Claude", letter: "Cl", color: "#C2410C" },
  duet: { label: "Duet", letter: "D", color: "#6D28D9" },
  unknown: { label: "Someone", letter: "?", color: "#5B606B" },
};

export const BOARD_BADGE: Record<Board, { letter: string; color: string }> = {
  josh: { letter: "J", color: "#16181D" },
  christine: { letter: "C", color: "#2F5BD3" },
  bishops: { letter: "B", color: "#8A5A00" },
};

export type HistoryLine = {
  id: string;
  actor: Actor;
  text: string;
  when: string;
  revertable: boolean; // a Claude or Duet change (handoff §5.4)
};

function actionText(actor: Actor, action: string, before?: Record<string, unknown>, after?: Record<string, unknown>): string {
  const who = MEMBER[actor]?.label ?? actor;
  switch (action) {
    case "create":
      return `${who} created the card`;
    case "move":
      return `${who} moved it ${String(before?.stage ?? "?")} → ${String(after?.stage ?? "?")}`;
    case "edit":
      return `${who} edited the card`;
    case "board_add":
      return `${who} added a board`;
    case "board_remove":
      return `${who} removed a board`;
    case "discard":
      return `${who} discarded the card`;
    case "archive":
      return `Archived`;
    case "restore":
      return `${who} restored the card`;
    case "revert":
      return `${who} reverted a change`;
    default:
      return `${who} ${action}`;
  }
}

// The history panel for a card, newest first (handoff §3.1, §4.6). Revert is offered on every
// Claude or Duet change (§5.4).
export function getCardHistory(cardId: string): HistoryLine[] {
  return readEntries(cardId)
    .map((e) => ({
      id: e.id,
      actor: e.actor,
      text: actionText(e.actor, e.action, e.before, e.after),
      when: e.at,
      revertable: (e.actor === "claude" || e.actor === "duet") && e.action !== "revert",
    }))
    .reverse();
}

export function contextPathFor(cardId: string): string {
  // Shown to the user as a folder-relative path (handoff §3.2).
  const abs = contextFile(cardId);
  const idx = abs.indexOf("/context/");
  return idx >= 0 ? `kanban${abs.slice(idx)}` : abs;
}

export const ALL_STAGES = STAGES;
