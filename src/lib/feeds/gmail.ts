import { getSetting, setSetting } from "../kanban/state";
import { liveFeeds } from "./mode";

// Gmail, for Awaiting reply and nudge drafts (handoff §2, §2.1, §7.3). Ordinary code, NO AI. The
// app NEVER sends email — this module creates drafts only; there is no send function here or on any
// live path (CLAUDE §8, spec §3, spec check 1). The stub stands in for Josh's mailbox in CI, build
// sessions and local dev; the live path (CC_LIVE_FEEDS=1 on the Mac mini) returns nothing until
// Josh connects Gmail, which happens after this build lands (handoff "What waits on Josh").

// ---- Connect state, intake address, nudge template (app_settings) -----------------------------

const GMAIL_CONNECTED_KEY = "gmail_connected_at";
const INTAKE_ADDRESS_KEY = "intake_address";
const NUDGE_TEMPLATE_KEY = "nudge_template_b";

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

// Fixed sample threads, each defined by how long ago Josh's last message was. Ages straddle the
// rule boundaries so the 2-day / 1-day-for-active-client logic is exercised deterministically
// (tests and the Awaiting reply panel). Threads where the other side replied last are not here —
// by definition Awaiting reply is only threads where Josh sent the last message.
const STUB_SENT: { id: string; to: string; toName: string; subject: string; ageHours: number; snippet: string }[] = [
  { id: "t-riverwood", to: "dana@riverwoodbuild.com", toName: "Dana Whitfield", subject: "Riverwood draw schedule", ageHours: 34, snippet: "Sending over the revised draw schedule for your sign-off." },
  { id: "t-spark", to: "joe@sparkelectric.com", toName: "Joe Abrams", subject: "Panel upgrade quote", ageHours: 77, snippet: "Following up on the panel upgrade quote from last week." },
  { id: "t-bnt", to: "mgarcia@bntconstruction.com", toName: "Maria Garcia", subject: "Pool deck change order", ageHours: 12, snippet: "Attached the change order for the pool deck tile." },
  { id: "t-tile", to: "sales@tilewarehouse.com", toName: "Tile Warehouse", subject: "Lead time on the porcelain", ageHours: 31, snippet: "Any update on the lead time for the porcelain order?" },
];

function hoursAgo(now: Date, h: number): string {
  return new Date(now.getTime() - h * 3600_000).toISOString();
}

export function sentThreads(now: Date): SentThread[] {
  if (liveFeeds()) return []; // Gmail is connected on the Mac mini after this build lands.
  return STUB_SENT.map((t) => ({
    id: t.id,
    to: t.to,
    toName: t.toName,
    subject: t.subject,
    lastMessageAt: hoursAgo(now, t.ageHours),
    snippet: t.snippet,
  }));
}

// ---- Intake messages (notes by email and carrier text-to-email) -------------------------------

export type IntakeMessage = {
  id: string; // Gmail message id (becomes the note's source_ref)
  via: "email" | "sms";
  from: string;
  text: string;
  receivedAt: string;
};

// Messages sitting in the intake mailbox waiting to become notes. The stub returns one email and
// one carrier text-to-email so both arrival paths are exercised (handoff §11 "Notes arrive from the
// intake email, a text-to-email message and the note Shortcut"). The Shortcut path is the
// POST /api/notes route, not this mailbox. Live returns nothing until Gmail is connected.
export function intakeMessages(): IntakeMessage[] {
  if (liveFeeds()) return [];
  return [
    {
      id: "gmail-intake-1",
      via: "email",
      from: "josh@worthprop.com",
      text: "Follow up with ES rep on the pooled window order",
      receivedAt: "2026-11-18T09:12:00-05:00",
    },
    {
      id: "gmail-intake-2",
      via: "sms",
      from: "15615551212@vtext.com",
      text: "Pick up permit packet at county office Thursday",
      receivedAt: "2026-11-18T14:03:00-05:00",
    },
  ];
}

// ---- Drafts (the ONLY write Gmail does; never a send) -----------------------------------------

export type GmailDraft = {
  threadId: string;
  to: string;
  body: string;
  createdAt: string;
};

// In-process record of drafts created, so a test can assert a draft was created without a send
// (spec check 1). Not persistence — the real draft lives in Gmail. Exposed read-only via draftsLog.
const DRAFTS: GmailDraft[] = [];

// Create a Gmail draft in a thread (handoff §2.1 Nudge; §4.4 nothing else). This is the only Gmail
// write the app makes. There is deliberately NO function that sends a draft or a message: the app
// never sends email (CLAUDE §8). The live path will call the Gmail "create draft" API only.
export function createDraft(input: { threadId: string; to: string; body: string; at: string }): GmailDraft {
  const draft: GmailDraft = {
    threadId: input.threadId,
    to: input.to,
    body: input.body,
    createdAt: input.at,
  };
  DRAFTS.push(draft);
  return draft;
}

export function draftsLog(): readonly GmailDraft[] {
  return DRAFTS;
}
