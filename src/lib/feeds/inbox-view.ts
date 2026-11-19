import { listPending } from "../kanban/pending";
import { awaitingReply } from "./awaiting";
import type { InboxNoteView } from "@/components/home/InboxNotes";
import type { AwaitingView } from "@/components/home/AwaitingReply";

// Server-side view builders for the Inbox and Awaiting reply (handoff §2). Shared by the Home
// panels and the /inbox screen so both show the same data. No AI.

export function inboxNotes(): InboxNoteView[] {
  return listPending().map((n) => ({
    id: n.id,
    via: n.via,
    received: n.received,
    text: n.text,
    suggestedProject: n.suggested_project,
    boards: n.boards,
    sorted: !!n.suggested_at,
  }));
}

export function awaitingItems(now: Date): AwaitingView[] {
  return awaitingReply(now).map((i) => ({
    id: i.id,
    to: i.to,
    firstName: i.firstName,
    subject: i.subject,
    snippet: i.snippet,
    matchKind: i.matchKind,
    matchLabel: i.matchLabel,
    daysWaiting: i.daysWaiting,
    threshold: i.threshold,
    isClient: i.isClient,
  }));
}
