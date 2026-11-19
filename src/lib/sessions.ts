import type Database from "better-sqlite3";
import { hashToken, newSessionToken } from "./crypto";

// Session storage with a SLIDING expiry (CC12 spec §1 "Stay signed in"). A session is extended to
// `now + SESSION_WINDOW_DAYS` every time it is used, so Josh and Christine stay signed in as long as
// they use the app within the window. The window is long on purpose — one year — so in normal use
// they never sign in again (2026-11-19 17:33 ruling). Sign out deletes the session; a restart never
// touches sessions (they live in the database), so an update or reboot never signs anyone out.
//
// The DB stores only the sha256 of the opaque cookie token, so a database read cannot recover a live
// cookie. This module is pure over an injected db + token so it can be unit-tested without Next's
// cookies() (CC12 check 7); auth.ts wires in getDb() and the cookie.

export const SESSION_WINDOW_DAYS = 365;

function windowMs(): number {
  return SESSION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

// Create a session row for a user. Returns the plaintext token (set it as the cookie) and the
// expiry to put on the cookie.
export function createSession(
  db: Database.Database,
  userId: number,
  now: Date = new Date(),
): { token: string; expires: Date } {
  const token = newSessionToken();
  const id = hashToken(token);
  const expires = new Date(now.getTime() + windowMs());
  db.prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(
    id,
    userId,
    now.toISOString(),
    expires.toISOString(),
  );
  return { token, expires };
}

// Resolve a session token to its user id, sliding the expiry forward on use. An expired session is
// treated as signed out and pruned. Returns the user id and the new expiry (so the caller can
// refresh the cookie), or null when there is no live session.
export function resolveSession(
  db: Database.Database,
  token: string,
  now: Date = new Date(),
): { userId: number; expires: Date } | null {
  const id = hashToken(token);
  const row = db.prepare("SELECT user_id, expires_at FROM sessions WHERE id = ?").get(id) as
    | { user_id: number; expires_at: string }
    | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < now.getTime()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    return null;
  }
  // Slide the expiry forward. Used within the window → stays signed in.
  const expires = new Date(now.getTime() + windowMs());
  db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(expires.toISOString(), id);
  return { userId: row.user_id, expires };
}

export function deleteSession(db: Database.Database, token: string): void {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(hashToken(token));
}
