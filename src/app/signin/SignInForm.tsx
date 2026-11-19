"use client";

import { useFormState, useFormStatus } from "react-dom";
import { signInAction, type SignInState } from "../actions";

const initial: SignInState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn accent" type="submit" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function SignInForm() {
  const [state, formAction] = useFormState(signInAction, initial);
  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label className="field">
        Username
        <input type="text" name="username" autoComplete="username" autoFocus required />
      </label>
      <label className="field">
        Password
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      {state.error ? (
        <div className="error" role="alert">
          {state.error}
        </div>
      ) : null}
      <SubmitButton />
    </form>
  );
}
