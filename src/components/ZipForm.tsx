"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveZipAction, type ZipSaveState } from "@/app/(app)/settings/feed-actions";

const initial: ZipSaveState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn ghost" type="submit" disabled={pending} style={{ height: 36 }}>
      {pending ? "Saving…" : "Save zip"}
    </button>
  );
}

// The saved weather zip (handoff §2, default 33472, editable). Changing it changes the weather
// source request on the next Refresh (spec check 3).
export default function ZipForm({ zip }: { zip: string }) {
  const [state, action] = useFormState(saveZipAction, initial);
  return (
    <form action={action} className="secret-row" data-testid="zip-form">
      <label className="label" htmlFor="weather-zip">
        Weather zip
      </label>
      <input
        id="weather-zip"
        type="text"
        name="zip"
        defaultValue={zip}
        inputMode="numeric"
        aria-label="Weather zip"
        data-testid="zip-input"
        style={{ maxWidth: 120 }}
      />
      <SaveButton />
      {state.ok ? (
        <span className="badge-set" role="status" data-testid="zip-saved">
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
