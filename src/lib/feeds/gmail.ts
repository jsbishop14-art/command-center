import { getSetting, setSetting } from "../kanban/state";
import { liveFeeds } from "./mode";
import { SAMPLE_SENT, SAMPLE_INTAKE } from "./samples";
import { listSentThreads, listIntakeMessages, createGmailDraft } from "./google";

// Gmail, for Awaiting reply, nudge drafts and note intake (handoff §2, §2.1, §4.4, §7.3). Ordinary
// code, NO AI. The app NEVER sends email — this module creates drafts only; there is no send
// function here or on any live path (CLAUDE §8, spec §3, check 5).
//
// Two mailboxes connect separately (CC11 spec §1): Josh's mailbox (Awaiting reply + nudge drafts)
// and the intake mailbox evanmbishop23@gmail.com (notes emailed or texted in). Each stores its own
// OAuth token (src/lib/feeds/google.ts). Two paths, both deterministic in CI / build sessions:
//  - Legacy stub path (CC_LIVE_FEEDS off, the default): the sample threads/messages directly.
//  - Live code path (CC_LIVE_FEEDS on): through the Google client — real Gmail on the Mac mini,
//    the stub Google here, returning the same samples with no real call (spec §2, §3).

// ---- Connect state, intake address, nudge template (app_settings) -----------------------------

const GMAIL_CONNECTED_KEY = "gmail_connected_at";
const INTAKE_CONNECTED_KEY = "intake_connected_at";
const INTAKE_ADDRESS_KEY = "intake_address";
const NUDGE_TEMPLATE_KEY = "nudge_template_b";

// The intake mailbox is a new, dedicated Google account (CC4-ASK-1, Josh 2026-11-19: "a new
// address. evanmbishop23@gmail.com"). The address is still editable in Settings; this is the
// default filled in when the mailbox is connected and no address has been set.
export const DEFAULT_INTAKE_ADDRESS = "evanmbishop23@gmail.com";

// Template B (handoff §2.1). The body ends at "Thanks," with no name — Gmail adds Josh's signature.
// [first name] fills from the recipient automatically. Editable in Settings.
export const DEFAULT_TEMPLATE_B =
  "Hi [first name], checking in on the below. Is there anything you need from me to move this forward? Thanks,";

export function gmailConnected(): boolean {
  return !!getSetting(GMAIL_CONNECTED_KEY);
}
export function connectGmail(at: string): void {
  setSetting(GMAIL_CONNECTED_KEY, at);
}
export function disconnectGmail(): void {
  setSetting(GMAIL_CONNECTED_KEY, "");
}

export function intakeConnected(): boolean {
  return !!getSetting(INTAKE_CONNECTED_KEY);
}
export function connectIntake(at: string): void {
  setSetting(INTAKE_CONNECTED_KEY, at);
  if (!intakeAddress()) setIntakeAddress(DEFAULT_INTAKE_ADDRESS);
}
export function disconnectIntake(): void {
  setSetting(INTAKE_CONNECTED_KEY, "");
}

export function intakeAddress(): string {
  return getSetting(INTAKE_ADDRESS_KEY) || "";
}
export function setIntakeAddress(addr: string): void {
  setSetting(INTAKE_ADDRESS_KEY, addr);
}

export function nudgeTemplate(): string {
  return getSetting(NUDGE_TEMPLATE_KEY) || DEFAULT_TEMPLATE_B;
}
export function setNudgeTemplate(text: string): void {
  setSetting(NUDGE_TEMPLATE_KEY, text);
}

// ---- Threads Josh sent last (source for Awaiting reply) ---------------------------------------

export type SentThread = {
  id: string;
  to: string;
  toName: string;
  subject: string;
  lastMessageAt: string; // ISO-8601
  snippet: string;
};

function hoursAgo(now: Date, h: number): string {
  return new Date(now.getTime() - h * 3600_000).toISOString();
}

// Build the sample sent threads, aged relative to `now`. Shared by the legacy stub path and the
// stub Google transport so both show identical threads.
export function sampleSentThreads(now: Date): SentThread[] {
  return SAMPLE_SENT.map((t) => ({
    id: t.id,
    to: t.to,
    toName: t.toName,
    subject: t.subject,
    lastMessageAt: hoursAgo(now, t.ageHours),
    snippet: t.snippet,
  }));
}

export function sentThreads(now: Date): SentThread[] {
  if (!liveFeeds()) return sampleSentThreads(now);
  return listSentThreads(now); // live code path (real Gmail on the Mac mini, stub Gmail here)
}

// ---- Intake messages (notes by email and carrier text-to-email) -------------------------------

export type IntakeMessage = {
  id: string; // Gmail message id (becomes the note's source_ref)
  via: "email" | "sms";
  from: string;
  text: string;
  receivedAt: string;
};

export function sampleIntakeMessages(): IntakeMessage[] {
  return SAMPLE_INTAKE.map((m) => ({ id: m.id, via: m.via, from: m.from, text: m.text, receivedAt: m.receivedAt }));
}

export function intakeMessages(): IntakeMessage[] {
  if (!liveFeeds()) return sampleIntakeMessages();
  return listIntakeMessages(); // live code path (real intake mailbox on the Mac mini, stub here)
}

// ---- Drafts (the ONLY write Gmail does; never a send) -----------------------------------------

export type GmailDraft = {
  threadId: string;
  to: string;
  body: string;
  createdAt: string;
};

// In-process record of drafts created, so a test can assert a draft was created without a send
// (check 5). Not persistence — the real draft lives in Gmail. Exposed read-only via draftsLog.
const DRAFTS: GmailDraft[] = [];

// Create a Gmail draft in a thread (handoff §2.1 Nudge; §4.4 nothing else). This is the only Gmail
// write the app makes. There is deliberately NO function that sends a draft or a message: the app
// never sends email (CLAUDE §8). On the live code path this calls the Google client's draft-create
// (real Gmail on the Mac mini, stub here) — still only a draft, never a send.
export function createDraft(input: { threadId: string; to: string; body: string; at: string }): GmailDraft {
  const draft: GmailDraft = {
    threadId: input.threadId,
    to: input.to,
    body: input.body,
    createdAt: input.at,
  };
  DRAFTS.push(draft);
  if (liveFeeds()) createGmailDraft({ threadId: input.threadId, to: input.to, body: input.body });
  return draft;
}

export function draftsLog(): readonly GmailDraft[] {
  return DRAFTS;
}
