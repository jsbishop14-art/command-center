"use client";

import { useFormState } from "react-dom";
import {
  issueTokenAction,
  revokeTokenAction,
  setDuetAction,
  type TokenState,
} from "@/app/(app)/settings/kanban-actions";

type Status = { writer: "claude" | "duet"; issued: boolean; revoked: boolean };

const initial: TokenState = {};

function TokenRow({ status, duetOn }: { status: Status; duetOn: boolean }) {
  const [state, formAction] = useFormState(issueTokenAction, initial);
  const label = status.writer === "claude" ? "Claude" : "Duet";
  const live = status.issued && !status.revoked;
  const showToken = state.token && state.writer === status.writer;
  return (
    <div className="secret-row">
      <div className="label">
        {label} token
        <span className="subtle" style={{ display: "block", fontWeight: 400 }}>
          {status.writer === "duet"
            ? duetOn
              ? "Duet is on; this token can act."
              : "Duet is off; this token is refused even if issued."
            : "Claude in a chat from another computer uses this token."}
        </span>
      </div>
      <div className="status">
        {live ? (
          <span className="badge-set" data-testid={`token-${status.writer}`}>
            issued
          </span>
        ) : (
          <span className="badge-unset" data-testid={`token-${status.writer}`}>
            {status.revoked ? "revoked" : "none"}
          </span>
        )}
      </div>
      <form action={formAction}>
        <input type="hidden" name="writer" value={status.writer} />
        <button className="btn ghost" type="submit">
          {live ? "Re-issue" : "Issue"}
        </button>
      </form>
      {live ? (
        <form action={revokeTokenAction}>
          <input type="hidden" name="writer" value={status.writer} />
          <button className="btn ghost" type="submit">
            Revoke
          </button>
        </form>
      ) : null}
      {showToken ? (
        <span className="badge-set" role="status" style={{ flexBasis: "100%" }}>
          New {label} token (shown once — copy it now):{" "}
          <code className="mono" data-testid={`new-token-${status.writer}`}>
            {state.token}
          </code>
        </span>
      ) : null}
    </div>
  );
}

// Settings panel for the action layer (handoff §4.8): the Duet on/off switch and a token per
// writer. The token's plaintext is shown once at issue and never again.
export default function ActionLayerPanel({ statuses, duetOn }: { statuses: Status[]; duetOn: boolean }) {
  return (
    <div className="settings-grid">
      <form action={setDuetAction} className="secret-row">
        <div className="label">
          Duet
          <span className="subtle" style={{ display: "block", fontWeight: 400 }}>
            Off by default. When off, Duet&apos;s token is refused entirely.
          </span>
        </div>
        <div className="status">
          <span className={duetOn ? "badge-set" : "badge-unset"} data-testid="duet-state">
            {duetOn ? "on" : "off"}
          </span>
        </div>
        <input type="hidden" name="on" value={duetOn ? "0" : "1"} />
        <button className="btn ghost" type="submit" data-testid="duet-toggle">
          {duetOn ? "Turn off" : "Turn on"}
        </button>
      </form>
      {statuses.map((s) => (
        <TokenRow key={s.writer} status={s} duetOn={duetOn} />
      ))}
    </div>
  );
}
