"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { overrideBudgetAction } from "@/app/(app)/builds/actions";

// Override the build-budget hold (handoff §7.1, process.md §12). Sets override_until to the next
// Monday 2:00 AM reset so the next runner start proceeds (check 5). Shown only while the hold is on.
export default function OverrideButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  function doOverride() {
    setError(null);
    start(async () => {
      const r = await overrideBudgetAction();
      if ("error" in r) setError(r.error);
      else router.refresh();
    });
  }
  return (
    <>
      <button
        className="btn dark"
        type="button"
        data-testid="budget-override"
        disabled={pending}
        onClick={doOverride}
      >
        {pending ? "…" : "Override"}
      </button>
      {error ? <span className="error" role="alert">{error}</span> : null}
    </>
  );
}
