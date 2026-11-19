"use client";

import { useFormState } from "react-dom";
import { revertAction, type RevertState } from "@/app/(app)/kanban/actions";

const initial: RevertState = {};

// Revert a Claude or Duet change (handoff §5.4). If the card changed again after the change, the
// server returns both versions and this asks before overwriting (a second submit with force=1).
export default function RevertButton({ logId }: { logId: string }) {
  const [state, formAction] = useFormState(revertAction, initial);
  const changedAgain = state.status === "changed_again";
  return (
    <form action={formAction} style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <input type="hidden" name="logId" value={logId} />
      <input type="hidden" name="force" value={changedAgain ? "1" : "0"} />
      <button
        type="submit"
        style={{
          height: 30,
          padding: "0 10px",
          borderRadius: 6,
          border: "1px solid rgba(22,24,29,0.14)",
          background: "rgba(255,255,255,0.75)",
          font: "inherit",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {changedAgain ? "Revert anyway" : "Revert"}
      </button>
      {changedAgain ? (
        <span className="subtle" role="alert" style={{ fontSize: 11 }}>
          The card changed again since then. Revert anyway will overwrite the current values.
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
