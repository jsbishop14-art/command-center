import { getDb } from "./db";
import { isBoard, type Board } from "./boards";

export { BOARDS, isBoard, type Board } from "./boards";

// Per-user preferences (handoff 1.3: the board toggle choice is remembered per user). Later builds
// also store panel order and collapsed state here.

export function getPref(userId: number, key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM user_prefs WHERE user_id = ? AND key = ?")
    .get(userId, key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setPref(userId: number, key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO user_prefs (user_id, key, value) VALUES (?, ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
    )
    .run(userId, key, value);
}

// The board toggle. Defaults to the user's own board the first time.
export function getBoard(userId: number, role: "josh" | "christine"): Board {
  const saved = getPref(userId, "board");
  if (saved && isBoard(saved)) return saved;
  return role === "christine" ? "christine" : "josh";
}

export function setBoard(userId: number, board: Board): void {
  setPref(userId, "board", board);
}

// Home panel layout per user (handoff §2, spec check 1): panel order and which are collapsed,
// saved per user so they survive a restart. The four panels in mockup order are the default.
export const HOME_PANELS = ["today", "inbox", "awaiting", "kanban"] as const;
export type HomePanelKey = (typeof HOME_PANELS)[number];
export type HomeLayout = { order: HomePanelKey[]; collapsed: HomePanelKey[] };

function isPanel(v: string): v is HomePanelKey {
  return (HOME_PANELS as readonly string[]).includes(v);
}

export function getHomeLayout(userId: number): HomeLayout {
  const raw = getPref(userId, "home_layout");
  let saved: { order?: unknown; collapsed?: unknown } = {};
  if (raw) {
    try {
      saved = JSON.parse(raw);
    } catch {
      saved = {};
    }
  }
  // Keep only known panels, in the saved order, then append any panel the saved order is missing
  // (e.g. a panel added in a later build) so the set is always complete and free of unknowns.
  const savedOrder = Array.isArray(saved.order) ? saved.order.filter((p): p is HomePanelKey => typeof p === "string" && isPanel(p)) : [];
  const order: HomePanelKey[] = [...new Set(savedOrder)];
  for (const p of HOME_PANELS) if (!order.includes(p)) order.push(p);
  const collapsed = Array.isArray(saved.collapsed)
    ? saved.collapsed.filter((p): p is HomePanelKey => typeof p === "string" && isPanel(p))
    : [];
  return { order, collapsed: [...new Set(collapsed)] };
}

export function setHomeLayout(userId: number, layout: HomeLayout): void {
  const order = layout.order.filter(isPanel);
  const collapsed = layout.collapsed.filter(isPanel);
  setPref(userId, "home_layout", JSON.stringify({ order, collapsed }));
}
