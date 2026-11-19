import { getDb } from "../db";
import { sentThreads, type SentThread } from "./gmail";
import { activeClientFor } from "./clients";

// Awaiting reply (handoff §2, spec §1): Gmail threads where Josh sent the last message and got no
// answer. Flag after 2 days, or 1 day if the recipient is a client with an active job. Rule-based,
// NO AI. The thread is matched to a project or deal by recipient email (EZ Binder customers come in
// CC6; until then a client match is the only label, else the bare address). "No reply needed"
// hides one thread without affecting future emails in it.

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
  matchLabel: string; // client name when matched, else the bare recipient address
};

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
    const client = activeClientFor(t.to);
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
      matchLabel: client ? `${client.name} (active job)` : t.to,
    });
  }
  return out.sort((a, b) => a.lastMessageAt.localeCompare(b.lastMessageAt));
}
