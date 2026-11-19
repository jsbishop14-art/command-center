"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveScoringAction, type ScoringState } from "@/app/(app)/settings/phone-actions";

// The scoring config editor (handoff §8.4, spec §3). Fields and current values come from the server
// page as props, so this client component pulls none of the database/config code into the bundle.

const initial: ScoringState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn accent" type="submit" disabled={pending} style={{ height: 36 }}>
      {pending ? "Saving…" : "Save scoring"}
    </button>
  );
}

export default function ScoringConfigPanel({
  fields,
  config,
}: {
  fields: { key: string; label: string }[];
  config: Record<string, number>;
}) {
  const [state, formAction] = useFormState(saveScoringAction, initial);
  return (
    <form action={formAction} className="phone-scoring">
      <div className="phone-scoring-grid">
        {fields.map((f) => (
          <label key={f.key} className="phone-scoring-field">
            <span>{f.label}</span>
            <input
              type="number"
              name={f.key}
              defaultValue={config[f.key]}
              aria-label={f.label}
              className="mono"
            />
          </label>
        ))}
      </div>
      <div className="phone-scoring-actions">
        <SaveButton />
        {state.ok ? (
          <span className="status" data-testid="scoring-saved">
            Saved
          </span>
        ) : null}
        {state.error ? (
          <span className="error" role="alert">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
