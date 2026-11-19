"use client";

import { useState } from "react";
import { proposeMoveAction } from "@/app/(app)/schedule/actions";

// Propose a schedule move (handoff §2.2). The mockup invites dragging a bar; this is the accessible,
// test-stable form that does the same thing — pick a task, set its new start and end, and the move
// is sent to EZ Binder as a proposal under X-EZB-Actor josh. EZ Binder changes nothing until Josh
// confirms the move there. No AI.

export type MoveTask = { taskId: string; jobId: string; label: string; startsOn: string; endsOn: string };

export default function ScheduleMove({ tasks }: { tasks: MoveTask[] }) {
  const [sel, setSel] = useState<MoveTask | null>(null);
  const [toStart, setToStart] = useState("");
  const [toEnd, setToEnd] = useState("");

  function pick(id: string) {
    const t = tasks.find((x) => x.taskId === id) ?? null;
    setSel(t);
    setToStart(t ? t.startsOn : "");
    setToEnd(t ? t.endsOn : "");
  }

  if (tasks.length === 0) return null;

  return (
    <form action={proposeMoveAction} className="gc-move" data-testid="schedule-move">
      <h3>Propose a move</h3>
      <label>
        Task
        <select
          name="taskPick"
          aria-label="Task to move"
          value={sel?.taskId ?? ""}
          onChange={(e) => pick(e.target.value)}
        >
          <option value="">Choose a task…</option>
          {tasks.map((t) => (
            <option key={t.taskId} value={t.taskId}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        New start
        <input type="date" name="toStart" aria-label="New start" value={toStart} onChange={(e) => setToStart(e.target.value)} />
      </label>
      <label>
        New end
        <input type="date" name="toEnd" aria-label="New end" value={toEnd} onChange={(e) => setToEnd(e.target.value)} />
      </label>
      <input type="hidden" name="jobId" value={sel?.jobId ?? ""} />
      <input type="hidden" name="taskId" value={sel?.taskId ?? ""} />
      <input type="hidden" name="fromStart" value={sel?.startsOn ?? ""} />
      <input type="hidden" name="fromEnd" value={sel?.endsOn ?? ""} />
      <button type="submit" disabled={!sel || !toStart || !toEnd} data-testid="schedule-move-submit">
        Propose move
      </button>
    </form>
  );
}
