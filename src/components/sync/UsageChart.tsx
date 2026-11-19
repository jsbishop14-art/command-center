"use client";

import type { DailyUsage } from "@/lib/sync/store";

// The 30-day usage panel (handoff §5.5): tokens per day for the last 30 days, split by Sync item.
// A compact stacked-bar chart. In CC7 it lives inside the Sync dialog; the Builds screen (CC8) and
// touch screen 2 (CC9) show the same totals. No AI.

const COLORS: Record<"inbox" | "kanban" | "schedule", string> = {
  inbox: "#273246",
  kanban: "#C2410C",
  schedule: "#1D4D30",
};

export default function UsageChart({ days }: { days: DailyUsage[] }) {
  const max = Math.max(1, ...days.map((d) => d.inbox + d.kanban + d.schedule));
  const total = days.reduce((s, d) => s + d.inbox + d.kanban + d.schedule, 0);
  return (
    <div className="sync-usage" data-testid="sync-usage-chart">
      <div className="sync-usage-head">
        <span className="subtle">Last 30 days · {total.toLocaleString("en-US")} tokens</span>
        <span className="sync-usage-legend">
          <span><i style={{ background: COLORS.inbox }} /> Inbox</span>
          <span><i style={{ background: COLORS.kanban }} /> Kanban</span>
          <span><i style={{ background: COLORS.schedule }} /> Schedule</span>
        </span>
      </div>
      <div className="sync-usage-bars" role="img" aria-label={`Sync token usage over the last 30 days, ${total} tokens total`}>
        {days.map((d) => {
          const sum = d.inbox + d.kanban + d.schedule;
          return (
            <div key={d.date} className="sync-usage-col" title={`${d.date}: ${sum.toLocaleString("en-US")} tokens`}>
              {(["schedule", "kanban", "inbox"] as const).map((k) =>
                d[k] > 0 ? (
                  <span key={k} style={{ height: `${(d[k] / max) * 100}%`, background: COLORS[k] }} />
                ) : null,
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
