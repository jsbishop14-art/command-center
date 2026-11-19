"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { lookupAction } from "@/app/(app)/phone/actions";

function LookupButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn accent phone-lookup-btn" type="submit" disabled={pending}>
      {pending ? "Looking up…" : "Look up"}
    </button>
  );
}

// The number box (handoff §8.6): auto-focuses, accepts any format or pasted text containing a
// number, runs on Enter. The server action normalizes it and lands on the result.
export default function LookupForm({ defaultValue = "" }: { defaultValue?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form action={lookupAction} className="phone-form">
      <label className="phone-field">
        Phone number
        <input
          ref={ref}
          type="text"
          name="phone"
          defaultValue={defaultValue}
          autoFocus
          placeholder="Type or paste a number in any format"
          aria-label="Phone number"
          className="phone-input mono"
        />
      </label>
      <LookupButton />
    </form>
  );
}
