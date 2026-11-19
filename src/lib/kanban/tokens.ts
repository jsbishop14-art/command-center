import "server-only";
import { getDb } from "../db";
import { newSessionToken, hashToken } from "../crypto";
import { duetEnabled } from "./state";
import type { TokenWriter } from "./types";

// Action-layer tokens (handoff §4.8). Claude and Duet each get their own revocable token, reached
// through the tunnel. Only the sha256 of a token is stored; the plaintext is shown once at issue
// and never again. The Duet on/off switch disables Duet's token.

export type TokenRow = { writer: TokenWriter; created_at: string; revoked_at: string | null };

// Issue (or re-issue) a token for a writer. Returns the plaintext token to show once.
export function issueToken(writer: TokenWriter, at: string): string {
  const token = newSessionToken();
  getDb()
    .prepare(
      `INSERT INTO action_tokens (writer, token_hash, created_at, revoked_at)
       VALUES (?, ?, ?, NULL)
       ON CONFLICT(writer) DO UPDATE SET token_hash = excluded.token_hash, created_at = excluded.created_at, revoked_at = NULL`,
    )
    .run(writer, hashToken(token), at);
  return token;
}

export function revokeToken(writer: TokenWriter, at: string): void {
  getDb().prepare("UPDATE action_tokens SET revoked_at = ? WHERE writer = ?").run(at, writer);
}

export type TokenDenial = "no_token" | "revoked" | "duet_off";

// Resolve a presented token to its writer, or a denial reason. Duet's token is refused when the
// Duet switch is off (handoff §4.8), even if the token is otherwise valid.
export function resolveToken(token: string | null | undefined): { writer: TokenWriter } | { denied: TokenDenial } {
  if (!token) return { denied: "no_token" };
  const hash = hashToken(token);
  const row = getDb()
    .prepare("SELECT writer, revoked_at FROM action_tokens WHERE token_hash = ?")
    .get(hash) as { writer: TokenWriter; revoked_at: string | null } | undefined;
  if (!row) return { denied: "no_token" };
  if (row.revoked_at) return { denied: "revoked" };
  if (row.writer === "duet" && !duetEnabled()) return { denied: "duet_off" };
  return { writer: row.writer };
}

// Status for Settings: whether each writer has a live token, and whether Duet is on. Never returns
// the token itself.
export function tokenStatus(): { writer: TokenWriter; issued: boolean; revoked: boolean }[] {
  const rows = getDb()
    .prepare("SELECT writer, revoked_at FROM action_tokens")
    .all() as { writer: TokenWriter; revoked_at: string | null }[];
  const byWriter = new Map(rows.map((r) => [r.writer, r]));
  return (["claude", "duet"] as TokenWriter[]).map((w) => {
    const r = byWriter.get(w);
    return { writer: w, issued: !!r, revoked: !!r?.revoked_at };
  });
}
