import { randomUUID } from "node:crypto";
import {
  type Target,
  parseTarget,
  targetKey,
  authorizeUrl,
  savePending,
  consumePending,
  exchangeCode,
  writeBundle,
  deleteBundle,
  clearFeedProblem,
  feedLabel,
} from "./google";
import { getFeed, setFeedConnectedAt, disconnectFeed } from "./store";
import { connectGmail, disconnectGmail, connectIntake, disconnectIntake } from "./gmail";

// Orchestrates connecting and disconnecting each Google target (CC11 spec §1). Ties the generic
// OAuth flow in google.ts to the per-target connected-state owners: calendars (calendar_feeds),
// Gmail and the intake mailbox (app_settings). No AI, and no real Google call in the default path.

// Reject an unknown target early so a bad slug cannot start an OAuth flow.
export function resolveTarget(raw: string): Target | null {
  const t = parseTarget(raw);
  if (!t) return null;
  if (t.kind === "calendar" && !getFeed(t.slug)) return null;
  return t;
}

// Start "Connect": save a one-time state and return the URL to send the browser to (Google's
// consent screen live; the stub consent route in CI / build sessions).
export function startConnect(t: Target, by: string, at: string): string {
  const state = randomUUID();
  savePending(state, t, by, at);
  return authorizeUrl(t, state);
}

export type FinishResult = { ok: boolean; target?: Target; error?: string };

// Finish "Connect" from the OAuth callback: validate the state, exchange the code for tokens, store
// them, mark the target connected and clear any expired/revoked Problem for it.
export async function finishConnect(state: string, code: string, at: string): Promise<FinishResult> {
  const pending = consumePending(state);
  if (!pending) return { ok: false, error: "unknown or expired sign-in state" };
  const t = parseTarget(pending.target);
  if (!t) return { ok: false, error: "unknown target" };
  const bundle = await exchangeCode(code, t);
  writeBundle(t, bundle, pending.by);
  setConnected(t, at);
  clearFeedProblem(targetKey(t));
  return { ok: true, target: t };
}

function setConnected(t: Target, at: string): void {
  if (t.kind === "calendar") setFeedConnectedAt(t.slug, at);
  else if (t.kind === "gmail") connectGmail(at);
  else connectIntake(at);
}

// Disconnect a target: remove its stored token, clear its connected state and any Problem. For a
// calendar this also clears its cached events (reusing the CC3 disconnect).
export function disconnect(t: Target): void {
  if (t.kind === "calendar") {
    disconnectFeed(t.slug); // deletes the token secret, cached events and connected_at
  } else {
    deleteBundle(t);
    if (t.kind === "gmail") disconnectGmail();
    else disconnectIntake();
  }
  clearFeedProblem(targetKey(t));
}

export { feedLabel };
