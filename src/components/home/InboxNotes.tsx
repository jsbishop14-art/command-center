"use client";

import { useState } from "react";
import { confirmNoteAction, dismissNoteAction } from "@/app/(app)/inbox/actions";

// The Inbox: pending notes awaiting Josh's decision (handoff §2, §4.4, spec §1). Each note shows
// its suggested project and boards from the last Sync, or "Not sorted yet" when it arrived after
// the last Sync. Confirm files it into a card; Change lets Josh pick the project and boards first;
// Dismiss removes it without a card. Nothing becomes a card without Confirm.

export type InboxNoteView = {
  id: string;
  via: "email" | "sms" | "shortcut";
  received: string;
  text: string;
  suggestedProject: string | null;
  boards: string[];
  sorted: boolean; // a Sync has suggested a project/boards (suggested_at set)
};

const BOARD_LABEL: Record<string, string> = { josh: "Josh", christine: "Christine", bishops: "Bishops" };
const VIA_LABEL: Record<string, string> = { email: "Email", sms: "Text", shortcut: "Shortcut" };
const ALL_BOARDS = ["josh", "christine", "bishops"] as const;

function firstLine(text: string): string {
  const line = text.split("\n")[0].trim();
  return line.length > 120 ? `${line.slice(0, 117)}…` : line || "Note";
}

function Note({ note }: { note: InboxNoteView }) {
  const [changing, setChanging] = useState(false);
  return (
    <div className="inbox-note" data-testid={`note-${note.id}`}>
      <div className="row">
        <span className={`kb-chip`} data-testid={`note-via-${note.id}`}>
          {VIA_LABEL[note.via]}
        </span>
        <span className="title" style={{ flex: 1 }}>
          {firstLine(note.text)}
        </span>
      </div>
      <div className="sub" data-testid={`note-sorted-${note.id}`}>
        {note.sorted ? (
          <>
            Suggested: {note.suggestedProject || "no project"} ·{" "}
            {note.boards.map((b) => BOARD_LABEL[b] || b).join(", ")}
          </>
        ) : (
          "Not sorted yet"
        )}
      </div>

      <form action={confirmNoteAction} className="inbox-actions">
        <input type="hidden" name="noteId" value={note.id} />

        <div
          className="inbox-change"
          data-testid={`change-fields-${note.id}`}
          style={{ display: changing ? "block" : "none" }}
        >
          <label className="field">
            <span>Project</span>
            <input
              type="text"
              name="project"
              defaultValue={note.suggestedProject || ""}
              placeholder="project slug (optional)"
              data-testid={`project-${note.id}`}
            />
          </label>
          <div className="board-picks" role="group" aria-label="Boards">
            {ALL_BOARDS.map((b) => (
              <label key={b} className="board-pick">
                <input
                  type="checkbox"
                  name="boards"
                  value={b}
                  defaultChecked={note.boards.includes(b)}
                  data-testid={`board-${note.id}-${b}`}
                />
                {BOARD_LABEL[b]}
              </label>
            ))}
          </div>
        </div>

        <div className="row">
          <button className="btn" type="submit" data-testid={`confirm-${note.id}`}>
            Confirm
          </button>
          <button
            className="btn ghost"
            type="button"
            data-testid={`change-${note.id}`}
            aria-expanded={changing}
            onClick={() => setChanging((v) => !v)}
          >
            Change
          </button>
          <button
            className="btn ghost"
            type="submit"
            formAction={dismissNoteAction}
            data-testid={`dismiss-${note.id}`}
          >
            Dismiss
          </button>
        </div>
      </form>
    </div>
  );
}

export default function InboxNotes({ notes }: { notes: InboxNoteView[] }) {
  if (notes.length === 0) {
    return (
      <p className="subtle" data-testid="inbox-empty">
        Nothing in the Inbox. Notes you email, text or send from the iPhone Shortcut land here.
      </p>
    );
  }
  return (
    <div className="inbox-list">
      {notes.map((n) => (
        <Note key={n.id} note={n} />
      ))}
    </div>
  );
}
