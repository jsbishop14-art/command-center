import { getDb } from "../db";
import { intakeMessages } from "./gmail";
import { createPendingNote } from "../kanban/pending";
import type { PendingNote } from "../kanban/pending";

// Note intake by email and carrier text-to-email (handoff §4.4, §7.3). Ordinary code, NO AI.
// Messages in the intake mailbox become pending notes in the kanban pending/ folder; they become
// cards only when Josh confirms (handoff §4.4, spec §1). The poll is deduped by the Gmail message
// id (intake_seen) so a second poll over the same message creates no duplicate note. The iPhone
// Shortcut is a separate arrival path (POST /api/notes), not this poll.

function alreadySeen(sourceRef: string): boolean {
  return !!getDb().prepare("SELECT 1 FROM intake_seen WHERE source_ref = ?").get(sourceRef);
}

function markSeen(sourceRef: string, noteId: string, at: string): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO intake_seen (source_ref, note_id, at) VALUES (?, ?, ?)")
    .run(sourceRef, noteId, at);
}

export type IntakeResult = { created: PendingNote[]; skipped: number };

// Poll the intake mailbox and create a pending note for each new message. via is email or sms
// (text-to-email). The note is unsorted until the next Sync suggests a project/board (CC7); Josh
// can file it by hand meanwhile (handoff §2 Inbox).
export function pollIntake(at: string): IntakeResult {
  const created: PendingNote[] = [];
  let skipped = 0;
  for (const m of intakeMessages()) {
    if (alreadySeen(m.id)) {
      skipped++;
      continue;
    }
    const note = createPendingNote({
      via: m.via,
      text: m.text,
      source_ref: m.id,
      at: m.receivedAt,
    });
    markSeen(m.id, note.id, at);
    created.push(note);
  }
  return { created, skipped };
}
