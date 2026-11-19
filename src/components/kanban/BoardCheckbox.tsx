"use client";

import { useTransition } from "react";
import { toggleBoardAction } from "@/app/(app)/kanban/actions";

// One "Show on boards" checkbox (handoff §3.1). Toggling calls the server action, which updates
// the card file through the app.
export default function BoardCheckbox({
  cardId,
  board,
  label,
  checked,
  accent,
}: {
  cardId: string;
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
        onChange={(e) => start(() => void toggleBoardAction(cardId, board, e.target.checked))}
      />
      <span>{label}</span>
    </label>
  );
}
