import { createDraft, nudgeTemplate, sentThreads, type GmailDraft } from "./gmail";
import { awaitingReply } from "./awaiting";
import { nowEastern } from "../kanban/time";

// Nudge (handoff §2, §2.1): create a Gmail draft in the same thread from template B, ending at
// "Thanks,". The app NEVER sends it (CLAUDE §8); this only creates a draft. No tokens — Josh clicks
// Nudge in the app, it is not an action-layer command. Rule-based fill, no AI.

export function fillTemplate(template: string, firstName: string): string {
  return template.replace(/\[first name\]/gi, firstName);
}

// Create the nudge draft for a thread. The thread must currently be in Awaiting reply (flagged and
// not dismissed); nudging anything else is refused so the button only acts on what is shown.
export function nudge(threadId: string, at: string = nowEastern()): GmailDraft {
  const now = new Date(at);
  const item = awaitingReply(now).find((i) => i.id === threadId);
  if (!item) {
    // Fall back to the raw thread (e.g. a nudge requested for a thread no longer flagged); still a
    // draft only, never a send. Keeps the recipient correct if the caller passed a known id.
    const thread = sentThreads(now).find((t) => t.id === threadId);
    if (!thread) throw new Error(`thread ${threadId} not found`);
    const first = (thread.toName || thread.to).split(/\s+|@/)[0];
    return createDraft({ threadId, to: thread.to, body: fillTemplate(nudgeTemplate(), first), at });
  }
  return createDraft({ threadId, to: item.to, body: fillTemplate(nudgeTemplate(), item.firstName), at });
}
