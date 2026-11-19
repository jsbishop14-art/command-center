"use client";

import { useFormState } from "react-dom";
import { noReplyNeededAction, nudgeAction, type NudgeState } from "@/app/(app)/inbox/actions";

// Awaiting reply (handoff §2, spec §1): Gmail threads where Josh sent the last message and got no
// answer — flagged after 2 days, or 1 day for a client with an active job. Rule-based, no AI.
// No reply needed hides one thread; Nudge creates a Gmail draft from template B (never sends).

export type AwaitingView = {
  id: string;
  to: string;
  firstName: string;
  subject: string;
  snippet: string;
  matchKind: "client" | "deal" | "none";
  matchLabel: string;
  daysWaiting: number;
  threshold: number;
  isClient: boolean;
};

const initial: NudgeState = {};

function Item({ item }: { item: AwaitingView }) {
  const [state, nudgeForm] = useFormState(nudgeAction, initial);
  const days = Math.floor(item.daysWaiting);
  return (
    <div className="awaiting-item" data-testid={`thread-${item.id}`}>
      <div className="row">
        <span className="title" style={{ flex: 1 }}>
          {item.subject}
        </span>
        <span className="mono subtle" data-testid={`waited-${item.id}`}>
          {days}d
        </span>
      </div>
      <div className="sub">
        To{" "}
        {item.matchKind === "deal" ? (
          <span className="deal-match" data-testid={`deal-${item.id}`}>
            {item.matchLabel}
          </span>
        ) : (
          item.matchLabel
        )}
        {item.isClient ? " · active job, 1-day rule" : " · 2-day rule"}
      </div>
      <div className="snippet subtle">{item.snippet}</div>
      <div className="row">
        <form action={nudgeForm}>
          <input type="hidden" name="threadId" value={item.id} />
          <button className="btn" type="submit" data-testid={`nudge-${item.id}`}>
            Nudge
          </button>
        </form>
        <form action={noReplyNeededAction}>
          <input type="hidden" name="threadId" value={item.id} />
          <button className="btn ghost" type="submit" data-testid={`noreply-${item.id}`}>
            No reply needed
          </button>
        </form>
        {state.ok ? (
          <span className="badge-set" role="status" data-testid={`drafted-${item.id}`}>
            Draft created in Gmail
          </span>
        ) : null}
        {state.error ? (
          <span className="subtle" role="status">
            {state.error}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function AwaitingReply({
  items,
  gmailConnected,
}: {
  items: AwaitingView[];
  gmailConnected: boolean;
}) {
  if (!gmailConnected) {
    return (
      <p className="subtle" data-testid="awaiting-disconnected">
        Gmail is not connected. Connect it in Settings to see threads awaiting a reply.
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p className="subtle" data-testid="awaiting-empty">
        Nothing is waiting on a reply.
      </p>
    );
  }
  return (
    <div className="awaiting-list">
      {items.map((i) => (
        <Item key={i.id} item={i} />
      ))}
    </div>
  );
}
