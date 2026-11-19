import Link from "next/link";
import type { Card } from "@/lib/kanban/card";
import { getCardHistory, contextPathFor, MEMBER } from "@/lib/kanban/view";
import { AREAS } from "@/lib/kanban/types";
import {
  saveFieldsAction,
  saveNotesAction,
  discardAction,
} from "@/app/(app)/kanban/actions";
import BoardCheckbox from "./BoardCheckbox";
import StageSelect from "./StageSelect";
import RevertButton from "./RevertButton";

const BOARD_LABEL: Record<string, { label: string; accent: string }> = {
  josh: { label: "Josh", accent: "#16181D" },
  christine: { label: "Christine", accent: "#2F5BD3" },
  bishops: { label: "Bishops", accent: "#8A5A00" },
};

// Card detail panel (handoff §3.1, mockup Kanban.dc.html): fields, Show on boards, notes, history
// with Revert on every Claude/Duet change, Discard, and the context file path.
export default function CardPanel({ card, backHref }: { card: Card; backHref: string }) {
  const history = getCardHistory(card.id);
  return (
    <aside className="kb-panel" aria-label="Card detail">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5B606B" }}>
          Card · {card.id}
        </span>
        <Link href={backHref} aria-label="Close" className="subtle">
          Close
        </Link>
      </div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{card.title}</div>

      <div className="fields">
        <span className="subtle">Stage</span>
        <StageSelect cardId={card.id} stage={card.stage} />
        <span className="subtle">Created by</span>
        <span>{MEMBER[card.created_by]?.label ?? card.created_by}</span>
      </div>

      <form action={saveFieldsAction} className="fields">
        <input type="hidden" name="id" value={card.id} />
        <span className="subtle">Area</span>
        <select name="area" defaultValue={card.area} aria-label="Area" style={{ height: 32, fontSize: 13 }}>
          {AREAS.map((a) => (
            <option key={a} value={a}>
              {a[0].toUpperCase() + a.slice(1)}
            </option>
          ))}
        </select>
        <span className="subtle">Project</span>
        <input type="text" name="project" defaultValue={card.project ?? ""} aria-label="Project" style={{ height: 32 }} />
        <span className="subtle">Due</span>
        <input type="date" name="due" defaultValue={card.due ?? ""} aria-label="Due date" style={{ height: 32 }} />
        <span />
        <button className="btn ghost" type="submit" style={{ height: 32, justifySelf: "start" }}>
          Save fields
        </button>
      </form>

      <fieldset>
        <legend>Show on boards</legend>
        {(["josh", "christine", "bishops"] as const).map((b) => (
          <BoardCheckbox
            key={b}
            cardId={card.id}
            board={b}
            label={BOARD_LABEL[b].label}
            accent={BOARD_LABEL[b].accent}
            checked={card.boards.includes(b)}
          />
        ))}
      </fieldset>

      <form action={saveNotesAction} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <input type="hidden" name="id" value={card.id} />
        <label className="subtle" htmlFor={`notes-${card.id}`}>
          Notes
        </label>
        <textarea
          id={`notes-${card.id}`}
          name="notes"
          rows={4}
          defaultValue={card.notes}
          aria-label="Notes"
          style={{
            font: "inherit",
            fontSize: 13,
            border: "1px solid rgba(22,24,29,0.14)",
            borderRadius: 8,
            padding: "8px 10px",
            resize: "vertical",
            background: "rgba(255,255,255,0.7)",
          }}
        />
        <button className="btn ghost" type="submit" style={{ height: 32, alignSelf: "start" }}>
          Save notes
        </button>
      </form>

      <section aria-label="History" className="kb-hist">
        <div style={{ fontSize: 12, fontWeight: 600 }}>History</div>
        {history.length === 0 ? <span className="subtle">No history yet.</span> : null}
        {history.map((h) => {
          const m = MEMBER[h.actor] ?? MEMBER.unknown;
          return (
            <div key={h.id} className="kb-hist-row">
              <span className="kb-badge" style={{ background: m.color, flex: "none" }}>
                {m.letter}
              </span>
              <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                <span>{h.text}</span>
                <span className="when">{h.when}</span>
              </span>
              {h.revertable ? <RevertButton logId={h.id} /> : null}
            </div>
          );
        })}
      </section>

      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#5B606B" }}>
        <span style={{ flex: 1 }}>Context file for Claude: {contextPathFor(card.id)}</span>
        <form action={discardAction}>
          <input type="hidden" name="id" value={card.id} />
          <button className="btn ghost" type="submit" style={{ height: 32 }}>
            Discard
          </button>
        </form>
      </div>
    </aside>
  );
}
