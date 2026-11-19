"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveSecretAction, type SecretSaveState } from "@/app/actions";
import type { SecretStatus } from "@/lib/secrets";

const initial: SecretSaveState = {};

function SaveButton({ isSet }: { isSet: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn ghost" type="submit" disabled={pending}>
      {pending ? "Saving…" : isSet ? "Replace" : "Save"}
    </button>
  );
}

function SecretRow({ secret }: { secret: SecretStatus }) {
  const [state, formAction] = useFormState(saveSecretAction, initial);
  return (
    <form action={formAction} className="secret-row">
      <div className="label">
        {secret.label}
        <span className="subtle" style={{ display: "block", fontWeight: 400 }}>
          used in {secret.usedIn}
        </span>
      </div>
      <div className="status">
        {secret.isSet ? (
          <span className="badge-set" data-testid={`status-${secret.name}`}>
            set · {secret.hint}
          </span>
        ) : (
          <span className="badge-unset" data-testid={`status-${secret.name}`}>
            not set
          </span>
        )}
      </div>
      <input type="hidden" name="name" value={secret.name} />
      <input
        type="password"
        name="value"
        placeholder={secret.isSet ? "enter a new value to replace" : "enter value"}
        aria-label={`${secret.label} value`}
        style={{ flex: "1 1 220px" }}
      />
      <SaveButton isSet={secret.isSet} />
      {state.error ? (
        <span className="error" role="alert">
          {state.error}
        </span>
      ) : null}
      {state.ok ? (
        <span className="badge-set" role="status">
          Saved.
        </span>
      ) : null}
    </form>
  );
}

export default function SecretsPanel({ secrets }: { secrets: SecretStatus[] }) {
  return (
    <div className="settings-grid">
      {secrets.map((s) => (
        <SecretRow key={s.name} secret={s} />
      ))}
    </div>
  );
}
