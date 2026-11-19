"use client";

import { useRef } from "react";
import { moveStageAction } from "@/app/(app)/kanban/actions";
import { COLUMN_DEFS } from "@/lib/kanban/types";

// Move a card between stages from the detail panel. Submitting the form runs the server action;
// the select auto-submits on change.
export default function StageSelect({ cardId, stage }: { cardId: string; stage: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form action={moveStageAction} ref={formRef}>
      <input type="hidden" name="id" value={cardId} />
      <select
        name="stage"
        defaultValue={stage}
        aria-label="Stage"
        onChange={() => formRef.current?.requestSubmit()}
        style={{ height: 32, fontSize: 13 }}
      >
        {COLUMN_DEFS.map((c) => (
          <option key={c.stage} value={c.stage}>
            {c.name}
          </option>
        ))}
        <option value="discarded">Discarded</option>
      </select>
    </form>
  );
}
