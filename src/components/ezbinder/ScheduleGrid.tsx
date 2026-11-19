import type { ScheduleGrid } from "@/lib/ezbinder/view";

// The GC schedule grid (handoff §2 item 4, mockup Main.dc.html). Server component; all bars come
// from the cache the sync and webhook fill. Solid bars are EZ Binder tasks; dashed bars are
// proposals (Josh, the slip rule or Claude) and show their source — they change nothing in EZ
// Binder until Josh confirms the move there (handoff §2.2). No AI.

export default function ScheduleGridView({ grid }: { grid: ScheduleGrid }) {
  if (!grid.hasData) {
    return (
      <p className="subtle" data-testid="schedule-empty">
        No active or sold-not-started jobs on the EZ Binder schedule yet.
      </p>
    );
  }
  const cols = `170px repeat(${grid.days.length}, minmax(0, 1fr))`;
  return (
    <div className="gc-grid-scroll">
      <div className="gc-grid" style={{ minWidth: 860 }}>
        <div className="gc-grid-head" style={{ gridTemplateColumns: cols }}>
          <span>Job</span>
          {grid.days.map((d) => (
            <span key={d.date} className={`gc-day${d.isToday ? " today" : ""}`}>
              {d.label}
            </span>
          ))}
        </div>
        {grid.rows.map((r) => (
          <div
            key={r.jobId}
            className="gc-row"
            style={{ gridTemplateColumns: cols }}
            data-testid={`gc-row-${r.jobId}`}
          >
            <span className="gc-job">
              <span className="gc-dot" style={{ background: r.dot }} aria-hidden="true" />
              {r.job}
            </span>
            {r.bars.map((b) => (
              <span
                key={b.key}
                className={`gc-bar ${b.kind}${b.source ? ` src-${b.source}` : ""}`}
                style={{ gridColumn: b.gridColumn }}
                data-testid={b.kind === "proposal" ? `gc-proposal-${r.jobId}` : undefined}
                data-source={b.source}
                title={b.title}
              >
                {b.title}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
