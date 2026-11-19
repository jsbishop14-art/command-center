import { buildsView } from "@/lib/builds/view";
import { STAGES } from "@/lib/builds/types";
import type { ProjectCard } from "@/lib/builds/types";
import UsageChart from "@/components/sync/UsageChart";
import QuestionPanel from "@/components/builds/QuestionPanel";
import CopyCommand from "@/components/builds/CopyCommand";
import OverrideButton from "@/components/builds/OverrideButton";

export const dynamic = "force-dynamic";

// The Builds screen (handoff §7.1, mockup Builds.dc.html). Shows every tracked project's state from
// GitHub (stubbed), the build budget tile with Override, and the Needs-you panel for answering build
// questions. Both logins reach it from the left menu / the top-bar bell. No AI, no outside call.

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ");
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtTokens(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

const STAGE_INDEX: Record<string, number> = { Queued: 0, "Queued · held by budget": 0, Building: 1, "Needs Josh": 2, Landed: 3 };

function stagePill(stage: ProjectCard["stage"]): { bg: string; ink: string } {
  switch (stage) {
    case "Building":
      return { bg: "#E3EFE7", ink: "#1D4D30" };
    case "Needs Josh":
      return { bg: "#DC2626", ink: "#FFFFFF" };
    case "Landed":
      return { bg: "#16181D", ink: "#FFFFFF" };
    case "Queued · held by budget":
      return { bg: "#FDE2E2", ink: "#7F1D1D" };
    default:
      return { bg: "rgba(22,24,29,0.08)", ink: "#3A3F49" };
  }
}

function currentLine(c: ProjectCard): string {
  if (!c.current) {
    return c.lastLanded ? `Last landed: ${c.lastLanded.name} · ${fmtTime(c.lastLanded.at)}` : "No builds yet";
  }
  if (c.needsJosh) return `Current build: ${c.current.name} · needs your answer`;
  if (c.answersSaved) return `Current build: ${c.current.name} · answers saved, waiting for the runner`;
  if (c.stage === "Queued · held by budget") return `Next: ${c.current.name} · not started, build budget on hold`;
  if (c.stage === "Queued") return `Next: ${c.current.name}`;
  return `Current build: ${c.current.name}${c.current.pickUpHere ? ` · ${c.current.pickUpHere}` : ""}`;
}

export default function BuildsPage() {
  const view = buildsView();
  const b = view.budget;
  const budgetPctLabel = b.configured ? (b.pct === null ? "—%" : `${b.pct}%`) : "—";

  return (
    <div className="builds">
      <div className="card">
        <h1>Software builds</h1>
        <p className="subtle">
          Every tracked project&rsquo;s build state, read from GitHub. Answer a build&rsquo;s questions
          here; the app writes your answer to its status file and restarts nothing — you paste the
          runner command when you are ready.
        </p>
      </div>

      {/* Usage + budget tiles */}
      <section className="builds-usage" aria-label="Usage">
        {view.usage.map((u) => (
          <div key={u.key} className="builds-tile" data-testid={`usage-${u.key}`}>
            <div className="builds-tile-head">
              <span className="subtle">{u.label}</span>
              <span className="mono subtle">{u.note}</span>
            </div>
            <div className="builds-tile-value mono">{u.value}</div>
          </div>
        ))}

        <div className={`builds-tile budget${b.hold ? " hold" : b.warn ? " warn" : ""}`} data-testid="budget-tile">
          <div className="builds-tile-head">
            <span className="subtle">Build budget · builds only</span>
            {b.hold ? <span className="badge-hold" data-testid="budget-hold">HOLD</span> : null}
            {!b.hold && b.warn ? <span className="badge-warn" data-testid="budget-warn">WARNING</span> : null}
            {b.overrideActive ? <span className="badge-ovr" data-testid="budget-override-active">OVERRIDE</span> : null}
          </div>
          {b.configured ? (
            <>
              <div className="builds-budget-row">
                <span className="builds-tile-value mono" data-testid="budget-pct">{budgetPctLabel}</span>
                <span className="mono subtle" data-testid="budget-amounts">
                  {fmtTokens(b.usedThisWeek)} of {b.limit === null ? "no limit" : `${fmtTokens(b.limit)} tokens`}
                </span>
              </div>
              <div className="builds-bar">
                <div
                  className="builds-bar-fill"
                  style={{
                    width: `${b.pct === null ? 0 : Math.min(100, b.pct)}%`,
                    background: b.hold ? "#DC2626" : b.warn ? "#C2410C" : "#16181D",
                  }}
                />
              </div>
              {b.hold ? (
                <div className="builds-budget-foot">
                  <span className="subtle">No new builds start. Running work finishes. Clears Mon 2:00 AM.</span>
                  <OverrideButton />
                </div>
              ) : b.overrideActive ? (
                <div className="subtle" data-testid="budget-override-until">
                  Override in force until {fmtTime(b.overrideUntil)}.
                </div>
              ) : (
                <div className="subtle">
                  {b.limit === null ? "Usage recorded; no limit set yet." : `Warning at ${b.warnPct}%.`}
                </div>
              )}
            </>
          ) : (
            <div className="builds-tile-value" data-testid="budget-not-setup">Budget not set up</div>
          )}
        </div>
      </section>

      <div className="builds-body">
        {/* Project cards */}
        <main className="builds-cards">
          {view.projects.map((c) => {
            const pill = stagePill(c.stage);
            const cur = STAGE_INDEX[c.stage] ?? 0;
            const allDone = c.stage === "Landed";
            return (
              <article
                key={c.repo}
                className={`builds-card${c.needsJosh || c.rolledBack ? " needs" : ""}`}
                data-testid={`build-card-${c.repo}`}
              >
                <div className="builds-card-head">
                  <h2>{c.name}</h2>
                  <span
                    className="builds-stage"
                    data-testid={`build-stage-${c.repo}`}
                    style={{ background: pill.bg, color: pill.ink }}
                  >
                    {c.stage}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span className="mono subtle" data-testid={`build-queue-${c.repo}`}>{c.queueLabel}</span>
                </div>
                <div className="subtle">{currentLine(c)}</div>
                <ol className="builds-track" aria-label="Build progress">
                  {STAGES.map((s, i) => {
                    const dn = allDone || i < cur;
                    const now = !allDone && i === cur;
                    const bar = dn ? "#16181D" : now ? (i === 2 ? "#DC2626" : "#C2410C") : "rgba(22,24,29,0.12)";
                    return (
                      <li key={s}>
                        <div className="builds-track-bar" style={{ background: bar }} />
                        <div className="builds-track-name" style={{ fontWeight: now ? 700 : 400, color: dn || now ? "#16181D" : "#5B606B" }}>{s}</div>
                      </li>
                    );
                  })}
                </ol>

                {c.live ? (
                  <div className="builds-live" data-testid={`build-live-${c.repo}`}>
                    <span className="dot-ok" /> Live on Mac mini: <span className="mono">{c.live.merge.slice(0, 8)}</span>, <span className="mono">{fmtTime(c.live.at)}</span>
                  </div>
                ) : null}

                {c.rolledBack ? (
                  <div className="builds-rollback" role="alert" data-testid={`build-rollback-${c.repo}`}>
                    <strong>Update failed, rolled back.</strong> {fmtTime(c.rolledBack.at)} · {c.rolledBack.log}
                  </div>
                ) : null}

                <div className="builds-card-foot">
                  <span className="subtle">
                    Last activity <span className="mono">{fmtTime(c.lastActivityAt)}</span>
                    {c.noActivityHours !== null ? (
                      <span className="builds-amber" data-testid={`build-noactivity-${c.repo}`}> · No activity for {c.noActivityHours} h</span>
                    ) : null}
                  </span>
                  <span style={{ flex: 1 }} />
                  {c.needsJosh ? (
                    <a className="btn accent builds-answer-link" href={`#needsyou-${c.repo}`}>Answer questions</a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </main>

        {/* Needs you + usage + activity */}
        <aside className="builds-aside">
          <section className="builds-needs" aria-label="Needs you">
            <div className="builds-needs-title">
              <h2>Needs you</h2>
              <span className="mono" data-testid="needsyou-count">{view.needsYou.filter((n) => n.kind === "questions").length}</span>
            </div>
            <p className="subtle">Answers are saved to the build&rsquo;s status file. The build continues after the runner restarts.</p>
            {view.needsYou.length === 0 ? (
              <div className="subtle" data-testid="needsyou-empty">Nothing waiting on you.</div>
            ) : (
              view.needsYou.map((n) =>
                n.kind === "questions" ? (
                  <QuestionPanel key={n.repo} item={n} />
                ) : (
                  <div key={n.project} className="builds-answered" data-testid={`needsyou-${n.project}`}>
                    <div className="builds-needs-head">
                      <strong>{n.project} · {n.buildName}</strong>
                      <span className="mono subtle">{n.answeredCount} of {n.answeredCount} answered</span>
                    </div>
                    <div className="builds-saved">✓ Answers saved. Restart the runner</div>
                    <div className="subtle">Paste this at the plain terminal prompt in the build workspace:</div>
                    <CopyCommand command={n.runnerCommand} />
                  </div>
                ),
              )
            )}
          </section>

          <section className="card builds-dash">
            <div className="builds-needs-title">
              <h2>Dashboard usage</h2>
              <span className="subtle">last 30 days · Sync tokens</span>
            </div>
            <UsageChart days={view.dashboard30} />
          </section>

          <section className="card">
            <h2>Recent activity</h2>
            <div className="builds-activity">
              {view.activity.length === 0 ? (
                <div className="subtle">No recent build activity.</div>
              ) : (
                view.activity.map((a, i) => (
                  <div key={i} className="builds-activity-row">
                    <span className="mono subtle">{a.at ? fmtTime(a.at) : ""}</span>
                    <span>{a.text}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
