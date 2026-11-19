import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { todayEastern } from "@/lib/kanban/time";
import { scheduleGrid, proposalLines } from "@/lib/ezbinder/view";
import { listTasks } from "@/lib/ezbinder/store";
import { startEzbSync } from "@/lib/ezbinder/sync";
import ScheduleGridView from "@/components/ezbinder/ScheduleGrid";
import ScheduleMove, { type MoveTask } from "@/components/ezbinder/ScheduleMove";
import { rejectProposalAction, syncScheduleAction } from "./actions";

export const dynamic = "force-dynamic";

// The GC schedule screen (handoff §2 item 4, §2.2). Shows the next two weeks, one row per active or
// sold-not-started job, with proposals as dashed bars showing their source. Josh proposes a move or
// rejects a proposal here; confirming a move happens in EZ Binder. No AI — ordinary code.

export default function SchedulePage() {
  const user = currentUser();
  if (!user) redirect("/signin");
  startEzbSync(); // arm the 90-minute safety-net poll (no-op in CI/dev where no sync is due)

  const today = todayEastern();
  const grid = scheduleGrid({ today });
  const proposals = proposalLines();
  const moveTasks: MoveTask[] = listTasks().map((t) => ({
    taskId: t.taskId,
    jobId: t.jobId,
    label: `${t.name} (${t.startsOn} → ${t.endsOn})`,
    startsOn: t.startsOn,
    endsOn: t.endsOn,
  }));

  return (
    <>
      <div className="screen-head">
        <h1>Schedule</h1>
        <form action={syncScheduleAction}>
          <button type="submit" className="btn" data-testid="schedule-sync">
            Sync from EZ Binder
          </button>
        </form>
      </div>

      <section className="card gc-schedule">
        <div className="gc-legend">
          <span>
            <span className="sw" style={{ background: "#15803D" }} /> Active
          </span>
          <span>
            <span className="sw" style={{ background: "#B45309" }} /> Sold, not started
          </span>
          <span>
            <span className="sw dashed" /> Proposal (you, rule or Claude)
          </span>
          <span className="mono subtle">EZ Binder schedule</span>
        </div>
        <ScheduleGridView grid={grid} />
      </section>

      <section className="card">
        <h2>Proposals</h2>
        {proposals.length === 0 ? (
          <p className="subtle" data-testid="no-proposals">
            No open proposals. A move you make, or a slip the rule finds, shows here until you confirm it in EZ Binder.
          </p>
        ) : (
          <ul className="proposal-list">
            {proposals.map((p) => (
              <li key={p.id} data-testid={`proposal-${p.id}`} data-source={p.source}>
                <div className="proposal-main">
                  <div className="proposal-text">{p.text}</div>
                  <div className="subtle">{p.note}</div>
                </div>
                <form action={rejectProposalAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="btn-ghost" data-testid={`reject-${p.id}`}>
                    Reject
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <p className="subtle small">
          A proposal changes nothing in EZ Binder. Confirm the move in EZ Binder to apply it; reject to clear it.
        </p>
      </section>

      <section className="card">
        <ScheduleMove tasks={moveTasks} />
      </section>
    </>
  );
}
