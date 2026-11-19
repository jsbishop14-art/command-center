import { getDb } from "./db";

// Per-user preferences (handoff 1.3: the board toggle choice is remembered per user). Later builds
// also store panel order and collapsed state here.
export const BOARDS = ["josh", "christine", "bishops"] as const;
export type Board = (typeof BOARDS)[number];

export function isBoard(value: string): value is Board {
  return (BOARDS as readonly string[]).includes(value);
}

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
