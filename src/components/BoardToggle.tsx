"use client";

import { useTransition } from "react";
import { setBoardAction } from "@/app/actions";
import { BOARDS, type Board } from "@/lib/boards";

const LABELS: Record<Board, string> = {
  josh: "Josh",
  christine: "Christine",
  bishops: "Bishops",
};

// The board toggle switches everything on screen to that board (handoff 1.3). The choice is saved
// per user, so it survives a restart (spec check 3). Data panels arrive in later builds; CC1
// persists and reflects the choice.
export default function BoardToggle({ board }: { board: Board }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="board-toggle" role="group" aria-label="Board">
      {BOARDS.map((b) => (
        <button
          key={b}
          type="button"
          aria-pressed={b === board}
          disabled={pending}
          onClick={() => startTransition(() => setBoardAction(b))}
        >
          {LABELS[b]}
        </button>
      ))}
    </div>
  );
}
