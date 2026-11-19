"use client";

import { useState } from "react";

// Copy the number to the clipboard (handoff §8.6 Copy number button). Client-only; no data leaves
// the app.
export default function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn ghost"
      data-testid="phone-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          // clipboard blocked; nothing else to do
        }
      }}
    >
      {done ? "Copied" : "Copy number"}
    </button>
  );
}
