import { getDb } from "../db";
import { sentThreads, type SentThread } from "./gmail";
import { activeClientFor } from "./clients";
import { contactByEmail } from "../deals/store";

// Awaiting reply (handoff §2, spec §1): Gmail threads where Josh sent the last message and got no
// answer. Flag after 2 days, or 1 day if the recipient is a client with an active job. Rule-based,
// NO AI. The thread is matched to a project or deal by recipient email: EZ Binder active-job clients
// (stub until CC6), then the Contacts list and its linked deals (handoff §3.4, spec check 3), else
// the bare address. "No reply needed" hides one thread without affecting future emails in it.

export const FLAG_DAYS_DEFAULT = 2;
export const FLAG_DAYS_ACTIVE_CLIENT = 1;

// ---- No reply needed (awaiting_dismissed) -----------------------------------------------------

export function dismissThread(threadId: string, at: string): void {
  getDb()
    .prepare(
      `INSERT INTO awaiting_dismissed (thread_id, at) VALUES (?, ?)
       ON CONFLICT(thread_id) DO UPDATE SET at = excluded.at`,
    )
    .run(threadId, at);
}

export function isDismissed(threadId: string): boolean {
  return !!getDb().prepare("SELECT 1 FROM awaiting_dismissed WHERE thread_id = ?").get(threadId);
}

function dismissedSet(): Set<string> {
  const rows = getDb().prepare("SELECT thread_id FROM awaiting_dismissed").all() as { thread_id: string }[];
  return new Set(rows.map((r) => r.thread_id));
}

// ---- The rule ---------------------------------------------------------------------------------

export type MatchKind = "client" | "deal" | "none";

export type AwaitingItem = {
  id: string;
  to: string;
  firstName: string;
  subject: string;
  snippet: string;
  lastMessageAt: string;
  daysWaiting: number;
  threshold: number;
  isClient: boolean;
  matchKind: MatchKind;
  matchLabel: string; // client name, matched deal name, else the bare recipient address
};

// Resolve a recipient to its display label and match kind (handoff §2, §3.4). Order: an EZ Binder
// active-job client (stub until CC6), then a Contacts match to its linked deal (spec check 3), else
// the bare address. Only a deal match names a deal; a contact with no linked deal falls through.
export function matchRecipient(to: string): { kind: MatchKind; label: string } {
  const client = activeClientFor(to);
  if (client) return { kind: "client", label: `${client.name} (active job)` };
  const contact = contactByEmail(to);
  if (contact && contact.deals.length) {
    const names = contact.deals.map((d) => d.name);
    return { kind: "deal", label: names.join(" · ") };
  }
  return { kind: "none", label: to };
}

function firstNameOf(toName: string, to: string): string {
  const n = (toName || "").trim();
  if (n) return n.split(/\s+/)[0];
  return to.split("@")[0];
}

function daysBetween(now: Date, iso: string): number {
  return (now.getTime() - new Date(iso).getTime()) / 86_400_000;
}

// Decide whether one thread should be flagged, with the threshold that applied (pure, for tests).
export function flagThread(thread: SentThread, now: Date): { flagged: boolean; daysWaiting: number; threshold: number; isClient: boolean } {
  const client = activeClientFor(thread.to);
  const threshold = client ? FLAG_DAYS_ACTIVE_CLIENT : FLAG_DAYS_DEFAULT;
  const daysWaiting = daysBetween(now, thread.lastMessageAt);
  return { flagged: daysWaiting >= threshold, daysWaiting, threshold, isClient: !!client };
}

// The flagged, not-dismissed threads to show on Awaiting reply, oldest first.
export function awaitingReply(now: Date): AwaitingItem[] {
  const dismissed = dismissedSet();
  const out: AwaitingItem[] = [];
  for (const t of sentThreads(now)) {
    if (dismissed.has(t.id)) continue;
    const r = flagThread(t, now);
    if (!r.flagged) continue;
    const match = matchRecipient(t.to);
    out.push({
      id: t.id,
      to: t.to,
      firstName: firstNameOf(t.toName, t.to),
      subject: t.subject,
      snippet: t.snippet,
      lastMessageAt: t.lastMessageAt,
      daysWaiting: r.daysWaiting,
      threshold: r.threshold,
      isClient: r.isClient,
      matchKind: match.kind,
      matchLabel: match.label,
    });
  }
  return out.sort((a, b) => a.lastMessageAt.localeCompare(b.lastMessageAt));
}
