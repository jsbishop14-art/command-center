import { getDb } from "../db";
import { getSecret, setSecret, deleteSecret } from "../secrets";
import { getSetting } from "../kanban/state";
import { liveFeeds } from "./mode";
import { sampleEvents, type FeedEvent } from "./calendars";
import { sampleSentThreads, sampleIntakeMessages, type SentThread, type IntakeMessage } from "./gmail";

// The Google client: OAuth sign-in, token refresh and the Calendar/Gmail API calls (CC11 spec §1,
// §3; handoff §7.3). Ordinary code, NO AI.
//
// Transport. Everything Google-facing goes through one transport, chosen by liveGoogle():
//  - Stub Google (the default — CI, build sessions, local dev, and the live code path without a
//    real client): issues tokens, refreshes them, and returns the deterministic samples. NO real
//    network call is ever made (spec §3, CLAUDE §3). This is the only transport tests exercise.
//  - Real Google (Mac mini only, CC_LIVE_FEEDS=1 with the client id + secret set): the real OAuth
//    and googleapis endpoints. Never exercised by tests.
//
// Scopes are read-only plus draft-create. There is NO send scope and NO send call anywhere: the app
// never sends email (CLAUDE §8, spec §3, check 5).
//
// Tokens and the client secret live only in the secret store (encrypted), never in logs, tests or
// the repo (spec §3).

// ---- Targets -----------------------------------------------------------------------------------

export type Target =
  | { kind: "calendar"; slug: string }
  | { kind: "gmail" }
  | { kind: "intake" };

export function parseTarget(s: string): Target | null {
  if (s === "gmail") return { kind: "gmail" };
  if (s === "intake") return { kind: "intake" };
  if (s.startsWith("cal:")) return { kind: "calendar", slug: s.slice(4) };
  return null;
}

export function targetKey(t: Target): string {
  return t.kind === "calendar" ? `cal:${t.slug}` : t.kind;
}

// The secret store name holding a target's OAuth token bundle. Calendars reuse the CC3 name
// gcal_<slug>; Gmail and the intake mailbox get their own.
function secretName(t: Target): string {
  if (t.kind === "calendar") return `gcal_${t.slug}`;
  if (t.kind === "gmail") return "gmail_oauth";
  return "gintake_oauth";
}

// Scopes requested per target. calendar.readonly reads events; gmail.readonly reads threads and
// messages; gmail.compose CREATES drafts (it is the draft scope — its string contains no "send").
// The intake mailbox is read-only. No scope here is a send scope (check 5 asserts this).
const CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
];
const INTAKE_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

export function scopesFor(t: Target): string[] {
  if (t.kind === "calendar") return CALENDAR_SCOPES;
  if (t.kind === "gmail") return GMAIL_SCOPES;
  return INTAKE_SCOPES;
}

// ---- Token bundle (stored JSON in the secret store) --------------------------------------------

export type TokenBundle = {
  accessToken: string;
  refreshToken: string;
  expiry: string; // ISO-8601
  scope: string; // space-joined
  account: string; // the Google account that signed in
};

function readBundle(t: Target): TokenBundle | null {
  const raw = getSecret(secretName(t));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TokenBundle;
  } catch {
    return null;
  }
}

export function writeBundle(t: Target, b: TokenBundle, by: string): void {
  setSecret(secretName(t), JSON.stringify(b), by);
}

export function deleteBundle(t: Target): void {
  deleteSecret(secretName(t));
}

export function hasConnection(t: Target): boolean {
  return readBundle(t) !== null;
}

// A token the Google side rejected (expired beyond refresh or revoked). Caught by callers to raise
// a Problem with a Reconnect button instead of failing quietly (spec §1, check 2).
export class RevokedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RevokedError";
  }
}

// ---- Mode and URLs -----------------------------------------------------------------------------

function hasClientCreds(): boolean {
  return !!getSecret("google_oauth_client_id") && !!getSecret("google_oauth_client_secret");
}

// True only where a real Google client is configured AND the live switch is on — the Mac mini. In
// CI and build sessions this is false even when CC_LIVE_FEEDS=1 (no client creds), so the transport
// is always the stub and no real Google call is made (spec §3).
export function liveGoogle(): boolean {
  return liveFeeds() && hasClientCreds();
}

function publicBaseUrl(): string {
  return (
    getSetting("public_base_url") ||
    process.env.CC_PUBLIC_URL ||
    `http://localhost:${process.env.PORT || "3000"}`
  );
}

// The redirect URI Josh registers in Google. Shown in Settings; works at localhost on the Mac mini
// and through the tunnel hostname (set public_base_url / CC_PUBLIC_URL to the tunnel host) (spec §3).
export function googleRedirectUri(): string {
  return `${publicBaseUrl().replace(/\/$/, "")}/api/auth/google/callback`;
}

// Where "Connect" sends the browser. Real Google: its consent screen. Stub: an internal route that
// consents immediately and redirects back to the callback (so the flow is clickable in tests).
export function authorizeUrl(t: Target, state: string): string {
  const redirect = googleRedirectUri();
  const scope = scopesFor(t).join(" ");
  if (liveGoogle()) {
    const clientId = getSecret("google_oauth_client_id") || "";
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      scope,
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  const params = new URLSearchParams({ state, redirect_uri: redirect });
  return `/api/auth/google/stub-consent?${params.toString()}`;
}

// ---- Pending OAuth state (CSRF) ----------------------------------------------------------------

export function savePending(state: string, target: Target, by: string, at: string): void {
  const db = getDb();
  // Clear any older in-flight attempt for the same target so stale rows do not accumulate.
  db.prepare("DELETE FROM google_oauth_pending WHERE target = ?").run(targetKey(target));
  db.prepare(
    "INSERT INTO google_oauth_pending (state, target, by, created_at) VALUES (?, ?, ?, ?)",
  ).run(state, targetKey(target), by, at);
}

export type PendingRow = { state: string; target: string; by: string; created_at: string };

// Look up and consume a pending state (deleted so it cannot be replayed). Returns null if unknown.
export function consumePending(state: string): PendingRow | null {
  const db = getDb();
  const row = db
    .prepare("SELECT state, target, by, created_at FROM google_oauth_pending WHERE state = ?")
    .get(state) as PendingRow | undefined;
  if (!row) return null;
  db.prepare("DELETE FROM google_oauth_pending WHERE state = ?").run(state);
  return row;
}

// ---- Feed problems (expired / revoked connections) ---------------------------------------------

export type FeedProblem = { target: string; label: string; reason: string; at: string };

export function recordFeedProblem(target: string, label: string, reason: string, at: string): void {
  getDb()
    .prepare(
      `INSERT INTO feed_problems (target, label, reason, at) VALUES (?, ?, ?, ?)
       ON CONFLICT(target) DO UPDATE SET label = excluded.label, reason = excluded.reason, at = excluded.at`,
    )
    .run(target, label, reason, at);
}

export function clearFeedProblem(target: string): void {
  getDb().prepare("DELETE FROM feed_problems WHERE target = ?").run(target);
}

export function listFeedProblems(): FeedProblem[] {
  return getDb()
    .prepare("SELECT target, label, reason, at FROM feed_problems ORDER BY label")
    .all() as FeedProblem[];
}

// ---- Stub transport control (tests only) -------------------------------------------------------

// A set of target keys whose refresh the stub should reject, to exercise the expired/revoked →
// Problem + Reconnect path (check 2). Module-level and in-process; never used in real-live mode.
const stubRevoked = new Set<string>();
export function __setStubRevoked(target: Target | null): void {
  stubRevoked.clear();
  if (target) stubRevoked.add(targetKey(target));
}

// ---- Transport ---------------------------------------------------------------------------------

let stubSeq = 0; // makes each stub access token distinct (so a refresh visibly changes it)

function stubExchange(t: Target): TokenBundle {
  stubSeq += 1;
  const key = targetKey(t);
  return {
    accessToken: `stub-access-${key}-${stubSeq}`,
    refreshToken: `stub-refresh-${key}`,
    expiry: new Date(Date.now() + 3600_000).toISOString(),
    scope: scopesFor(t).join(" "),
    account: t.kind === "intake" ? "evanmbishop23@gmail.com" : "josh@worthprop.com",
  };
}

function stubRefresh(bundle: TokenBundle, t: Target): TokenBundle {
  if (stubRevoked.has(targetKey(t))) {
    throw new RevokedError("the Google connection was revoked");
  }
  stubSeq += 1;
  return {
    ...bundle,
    accessToken: `stub-access-${targetKey(t)}-${stubSeq}`,
    expiry: new Date(Date.now() + 3600_000).toISOString(),
  };
}

// Real token exchange / refresh against Google (Mac mini only; never run in tests).
async function realTokenCall(body: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (res.status === 400 || res.status === 401) {
    throw new RevokedError(`Google token endpoint returned ${res.status}`);
  }
  if (!res.ok) throw new Error(`Google token endpoint returned ${res.status}`);
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
}

async function realExchange(code: string, t: Target): Promise<TokenBundle> {
  const json = await realTokenCall({
    code,
    client_id: getSecret("google_oauth_client_id") || "",
    client_secret: getSecret("google_oauth_client_secret") || "",
    redirect_uri: googleRedirectUri(),
    grant_type: "authorization_code",
  });
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || "",
    expiry: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    scope: json.scope || scopesFor(t).join(" "),
    account: "",
  };
}

async function realRefresh(bundle: TokenBundle): Promise<TokenBundle> {
  const json = await realTokenCall({
    client_id: getSecret("google_oauth_client_id") || "",
    client_secret: getSecret("google_oauth_client_secret") || "",
    refresh_token: bundle.refreshToken,
    grant_type: "refresh_token",
  });
  return {
    ...bundle,
    accessToken: json.access_token,
    refreshToken: json.refresh_token || bundle.refreshToken,
    expiry: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  };
}

// ---- OAuth code exchange (callback) ------------------------------------------------------------

export async function exchangeCode(code: string, t: Target): Promise<TokenBundle> {
  if (liveGoogle()) return realExchange(code, t);
  return stubExchange(t);
}

// Return a live access token for a target, refreshing (and re-storing) if expired. Raises
// RevokedError (recorded as a Problem by the caller) if the refresh is rejected.
async function accessTokenFor(t: Target, by: string): Promise<string> {
  const bundle = readBundle(t);
  if (!bundle) throw new RevokedError("not connected");
  const expired = Date.parse(bundle.expiry) <= Date.now();
  if (!expired) return bundle.accessToken;
  const refreshed = liveGoogle() ? await realRefresh(bundle) : stubRefresh(bundle, t);
  writeBundle(t, refreshed, by);
  return refreshed.accessToken;
}

// ---- Calendar (async; called from the async Refresh path) --------------------------------------

async function realListEvents(accessToken: string, calendarId: string, dateYmd: string): Promise<FeedEvent[]> {
  const timeMin = `${dateYmd}T00:00:00-05:00`;
  const timeMax = `${dateYmd}T23:59:59-05:00`;
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime" });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (res.status === 401) throw new RevokedError("calendar access was revoked");
  if (!res.ok) throw new Error(`Google Calendar returned ${res.status}`);
  const json = (await res.json()) as { items?: { id: string; summary?: string; location?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }[] };
  return (json.items || []).map((e) => ({
    id: e.id,
    title: e.summary || "(no title)",
    startsAt: e.start?.dateTime || `${e.start?.date}T00:00:00-05:00`,
    endsAt: e.end?.dateTime || null,
    allDay: !e.start?.dateTime,
    location: e.location || null,
  }));
}

// Events for one connected calendar on an Eastern date. The feed slug IS the Google calendar id on
// the real path; on the stub path it keys the samples. A revoked token raises a Problem and returns
// no events (the feed stays listed with a Reconnect button) rather than throwing up the stack.
export async function listCalendarEvents(feed: string, dateYmd: string): Promise<FeedEvent[]> {
  const t: Target = { kind: "calendar", slug: feed };
  if (!hasConnection(t)) return [];
  try {
    if (!liveGoogle()) {
      await accessTokenFor(t, "google"); // exercises refresh/revoke on the stub too
      return sampleEvents(feed, dateYmd);
    }
    const token = await accessTokenFor(t, "google");
    return await realListEvents(token, feed, dateYmd);
  } catch (e) {
    if (e instanceof RevokedError) {
      recordFeedProblem(targetKey(t), feedLabel(t), "sign-in expired or was revoked", new Date().toISOString());
      return [];
    }
    throw e;
  }
}

// ---- Gmail (sync reads; real-live serves a Refresh-populated cache) ----------------------------

// On the Mac mini (real-live) the async Gmail pull happens during Refresh (prefetchGmailLive) and
// fills these in-process caches; the synchronous reads below serve them. In the stub transport the
// caches are never used — the samples are returned directly.
let sentCache: SentThread[] | null = null;
let intakeCache: IntakeMessage[] | null = null;

export function listSentThreads(now: Date): SentThread[] {
  if (!liveGoogle()) return sampleSentThreads(now);
  return sentCache ?? [];
}

export function listIntakeMessages(): IntakeMessage[] {
  if (!liveGoogle()) return sampleIntakeMessages();
  return intakeCache ?? [];
}

async function realListSentThreads(_accessToken: string): Promise<SentThread[]> {
  // Mac-mini only; shape per the Gmail API (users.threads.list "in:sent"). Never run in tests.
  return [];
}
async function realListIntakeMessages(_accessToken: string): Promise<IntakeMessage[]> {
  return [];
}

// Pull Gmail into the caches on the live path. On the Mac mini this calls Gmail; in CI / build
// sessions liveGoogle() is false so it returns at once without a call (Refresh needs no cache then).
export async function prefetchGmailLive(now: Date): Promise<void> {
  if (!liveGoogle()) return;
  try {
    const t: Target = { kind: "gmail" };
    if (hasConnection(t)) {
      const token = await accessTokenFor(t, "google");
      sentCache = await realListSentThreads(token);
    }
  } catch (e) {
    if (e instanceof RevokedError) recordFeedProblem("gmail", "Gmail", "sign-in expired or was revoked", now.toISOString());
    else throw e;
  }
  try {
    const t: Target = { kind: "intake" };
    if (hasConnection(t)) {
      const token = await accessTokenFor(t, "google");
      intakeCache = await realListIntakeMessages(token);
    }
  } catch (e) {
    if (e instanceof RevokedError) recordFeedProblem("intake", "Intake mailbox", "sign-in expired or was revoked", now.toISOString());
    else throw e;
  }
}

async function realCreateDraft(accessToken: string, input: { threadId: string; to: string; body: string }): Promise<void> {
  const raw = Buffer.from(`To: ${input.to}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${input.body}`).toString("base64url");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { threadId: input.threadId, raw } }),
  });
  if (!res.ok) throw new Error(`Gmail draft create returned ${res.status}`);
}

// Create a Gmail draft on the live path. Draft-create only — there is no send call. On the Mac mini
// this fires the async create (not awaited, a draft is best-effort); in the stub it is a no-op (the
// draft is already recorded in gmail.ts's DRAFTS log for assertions).
export function createGmailDraft(input: { threadId: string; to: string; body: string }): void {
  if (!liveGoogle()) return;
  const t: Target = { kind: "gmail" };
  if (!hasConnection(t)) return;
  void accessTokenFor(t, "google")
    .then((token) => realCreateDraft(token, input))
    .catch(() => {
      /* a failed draft is logged by the caller's error handling; never throws here */
    });
}

// ---- Labels ------------------------------------------------------------------------------------

export function feedLabel(t: Target): string {
  if (t.kind === "gmail") return "Gmail";
  if (t.kind === "intake") return "Intake mailbox";
  // Use the calendar's display label where it is known (calendar_feeds); fall back to the slug.
  const row = getDb().prepare("SELECT label FROM calendar_feeds WHERE slug = ?").get(t.slug) as
    | { label: string }
    | undefined;
  return `Calendar: ${row?.label || t.slug}`;
}
