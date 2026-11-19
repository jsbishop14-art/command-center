import { timingSafeEqual } from "node:crypto";
import { newSessionToken, hashToken } from "./crypto";
import { getSetting, setSetting } from "./kanban/state";

// The iPhone Shortcut token (handoff §8.7, roles §7). A single Bearer token that works ONLY on the
// Shortcut routes — POST /api/notes (this build) and the phone routes (§8.7, CC10) — and on no
// other route. It can be revoked and regenerated in Settings, and is rate limited. Only the sha256
// hash is stored (app_settings), never the plaintext; the plaintext is shown once at issue.

const TOKEN_HASH_KEY = "shortcut_token_hash";
const TOKEN_CREATED_KEY = "shortcut_token_created_at";

export function issueShortcutToken(at: string): string {
  const token = newSessionToken();
  setSetting(TOKEN_HASH_KEY, hashToken(token));
  setSetting(TOKEN_CREATED_KEY, at);
  return token;
}

export function revokeShortcutToken(): void {
  setSetting(TOKEN_HASH_KEY, "");
  setSetting(TOKEN_CREATED_KEY, "");
}

export type ShortcutTokenStatus = { issued: boolean; createdAt: string | null };

export function shortcutTokenStatus(): ShortcutTokenStatus {
  const hash = getSetting(TOKEN_HASH_KEY);
  return { issued: !!hash, createdAt: hash ? getSetting(TOKEN_CREATED_KEY) : null };
}

// True only for a presented token that matches the issued Shortcut token. Constant-time compare on
// the hashes so a wrong token cannot be distinguished by timing. Returns false when no token is
// issued, so a revoked (cleared) token refuses everything.
export function isValidShortcutToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const stored = getSetting(TOKEN_HASH_KEY);
  if (!stored) return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(stored, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ---- Rate limit (handoff §8.7: the Shortcut routes are rate limited) --------------------------

// A small fixed-window limiter, per process. The Shortcut posts one note or lookup at a time from
// one phone; this only stops a runaway client. Not security-critical (the token already gates the
// route); kept in memory so it needs no table and resets on restart.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits: number[] = [];

export function rateLimitOk(now: number): boolean {
  const cutoff = now - WINDOW_MS;
  while (hits.length && hits[0] < cutoff) hits.shift();
  if (hits.length >= MAX_PER_WINDOW) return false;
  hits.push(now);
  return true;
}
