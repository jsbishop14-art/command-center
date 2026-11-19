"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  checkForUpdatesAction,
  type UpdatesCheckState,
} from "@/app/(app)/settings/updates-actions";
import type { UpdatesStatus } from "@/lib/builds/updates";

const initial: UpdatesCheckState = {};

function when(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { timeZone: "America/New_York" });
}

function CheckButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="btn ghost"
      type="submit"
      disabled={pending}
      data-testid="updates-check"
      style={{ height: 36 }}
    >
      {pending ? "Checking…" : "Check for updates now"}
    </button>
  );
}

// The Updates section (CC12): the version that is live, when the last check ran and its result, and
// a button that runs one update pass on command. Updates otherwise run once a day at 3 AM Eastern.
export default function UpdatesPanel({ status }: { status: UpdatesStatus }) {
  const [state, action] = useFormState(checkForUpdatesAction, initial);
  // After a check, prefer the just-returned result; otherwise show the stored last check.
  const lastAt = state.ok ? state.at : status.lastCheck?.at;
  const lastDetail = state.ok ? state.detail : status.lastCheck?.detail;
  return (
    <div className="feed-list" data-testid="updates-panel">
      <div className="secret-row">
        <span className="label">Live version</span>
        <span className="status" data-testid="updates-live">
          {status.live ? `${status.live.title} (${when(status.live.at)})` : "not recorded yet"}
        </span>
      </div>
      <div className="secret-row">
        <span className="label">Last checked</span>
        <span className="status" data-testid="updates-last">
          {lastAt ? `${when(lastAt)} — ${lastDetail ?? ""}` : "never"}
        </span>
      </div>
      <form action={action} className="secret-row">
        <CheckButton />
        {state.ok ? (
          <span className="badge-set" role="status" data-testid="updates-result">
            Checked
          </span>
        ) : null}
        {state.error ? (
          <span className="error" role="alert" data-testid="updates-error">
            {state.error}
          </span>
        ) : null}
      </form>
    </div>
  );
}
