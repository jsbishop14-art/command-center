"use client";

import { useTransition } from "react";
import { toggleDealBoardAction } from "@/app/(app)/deals/actions";

// One "Show on boards" checkbox for a deal (handoff §3.3, §1.3). Toggling calls the server action,
// which updates the deal through the action layer. A deal shows on every board it lists.
export default function DealBoardCheckbox({
  dealId,
  board,
  label,
  checked,
  accent,
}: {
  dealId: number;
  board: string;
  label: string;
  checked: boolean;
  accent: string;
}) {
  const [pending, start] = useTransition();
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 32, opacity: pending ? 0.6 : 1 }}>
      <input
        type="checkbox"
        defaultChecked={checked}
        aria-label={`Show on ${label}`}
        style={{ width: 18, height: 18, accentColor: accent }}
        onChange={(e) => start(() => void toggleDealBoardAction(dealId, board, e.target.checked))}
      />
      <span>{label}</span>
    </label>
  );
}
