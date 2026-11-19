"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveTouchIdleAction, type TouchIdleState } from "@/app/(app)/settings/touch-actions";

const initial: TouchIdleState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn ghost" type="submit" disabled={pending} style={{ height: 36 }}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

// The touch screen's idle return time (handoff §6: editable, default 3 minutes). Changing it changes
// how long the touch screen waits before returning to screen 1.
export default function TouchIdleForm({ minutes }: { minutes: number }) {
  const [state, action] = useFormState(saveTouchIdleAction, initial);
  return (
    <form action={action} className="secret-row" data-testid="touch-idle-form">
      <label className="label" htmlFor="touch-idle">
        Return to screen 1 after (minutes)
      </label>
      <input
        id="touch-idle"
        type="text"
        name="minutes"
        defaultValue={minutes}
        inputMode="numeric"
        aria-label="Idle minutes"
        data-testid="touch-idle-input"
        style={{ maxWidth: 100 }}
      />
      <SaveButton />
      {state.ok ? (
        <span className="badge-set" role="status" data-testid="touch-idle-saved">
          Saved
        </span>
      ) : null}
      {state.error ? (
        <span className="error" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
