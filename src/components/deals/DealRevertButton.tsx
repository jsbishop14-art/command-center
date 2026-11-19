"use client";

import { useFormState } from "react-dom";
import { revertDealAction, type DealRevertState } from "@/app/(app)/deals/actions";

const initial: DealRevertState = {};

// Revert a Claude or Duet deal change (handoff §5.4: "A reverted deal change restores the earlier
// deal values"). If the deal changed again after the change, the server returns both versions and
// this asks before overwriting (a second submit with force=1).
export default function DealRevertButton({ changeId }: { changeId: number }) {
  const [state, formAction] = useFormState(revertDealAction, initial);
  const changedAgain = state.status === "changed_again";
  return (
    <form action={formAction} style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <input type="hidden" name="changeId" value={changeId} />
      <input type="hidden" name="force" value={changedAgain ? "1" : "0"} />
      <button type="submit" className="btn ghost" style={{ height: 30, fontSize: 11, fontWeight: 600 }} data-testid={`deal-revert-${changeId}`}>
        {changedAgain ? "Revert anyway" : "Revert"}
      </button>
      {changedAgain ? (
        <span className="subtle" role="alert" style={{ fontSize: 11 }}>
          The deal changed again since then. Revert anyway will overwrite the current values.
        </span>
      ) : null}
      {state.error ? (
        <span className="error" role="alert" style={{ fontSize: 11 }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
