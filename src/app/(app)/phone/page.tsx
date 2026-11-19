import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { nowEastern, todayEastern } from "@/lib/kanban/time";
import { ensureFtcData, backfillProgress } from "@/lib/phone/ftc";
import { startPhoneJobs } from "@/lib/phone/jobs";
import { reopenLookup, displayName, type LookupResult } from "@/lib/phone/lookup";
import { listHistory, getMark, type LookupRow } from "@/lib/phone/store";
import { formatShortDate } from "@/lib/phone/dates";
import { formatPhone } from "@/lib/phone/normalize";
import { VERDICT_LABEL, VERDICT_COLOR, lineLabel, verdictForMark } from "@/lib/phone/view";
import { verdictFromScore, type Verdict } from "@/lib/phone/scoring";
import { getScoringConfig } from "@/lib/phone/config";
import LookupForm from "@/components/phone/LookupForm";
import CopyButton from "@/components/phone/CopyButton";
import { markAction, unmarkAction, refreshAction } from "./actions";

export const dynamic = "force-dynamic";

// Phone lookup screen (handoff §8.6, mockup PhoneLookup). Available to both logins, not tied to a
// board (§8.8). No AI. The number box runs a lookup; the result card, data status and 90-day
// history follow the mockup.
export default async function PhonePage({
  searchParams,
}: {
  searchParams: { sel?: string; q?: string; err?: string; n?: string };
}) {
  const user = currentUser();
  if (!user) redirect("/signin");

  startPhoneJobs(); // arms the background FTC ingest on the Mac mini only (no-op in CI/dev)
  await ensureFtcData(todayEastern(), nowEastern()); // instant in stub mode; no-op when live

  const sel = (searchParams.sel || "").replace(/\D/g, "");
  const result = sel ? reopenLookup(sel) : null;
  const query = (searchParams.q || "").trim();
  const history = listHistory(query);
  const progress = backfillProgress(todayEastern());

  return (
    <>
      <div className="card phone-top">
        <h1>Phone lookup</h1>
        <span className="subtle">Not tied to a board · no AI</span>
      </div>

      <div className="card">
        <LookupForm defaultValue={searchParams.n || result?.display || ""} />
        {searchParams.err ? (
          <p className="error" role="alert" data-testid="phone-error" style={{ marginTop: 10 }}>
            That doesn&rsquo;t look like a US phone number. Enter 10 digits (any format).
          </p>
        ) : null}
      </div>

      <div className="phone-layout">
        {result ? <ResultCard r={result} /> : <EmptyResult />}
        <aside className="phone-aside">
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Data status</h2>
            <div className="phone-status-row" data-testid="ftc-through">
              <span className="dot-ok" aria-hidden="true" />
              {progress.syncedThrough
                ? `FTC data current through ${formatShortDate(progress.syncedThrough)}`
                : "FTC data loading"}
            </div>
            <div className="phone-progress">
              <div className="phone-progress-head subtle">
                <span>12-month backfill</span>
                <span className="mono" data-testid="ftc-progress">
                  {progress.pct}%
                </span>
              </div>
              <div className="phone-progress-track">
                <div className="phone-progress-fill" style={{ width: `${progress.pct}%` }} />
              </div>
            </div>
            <div className="phone-status-row">
              <span className="dot-ok" aria-hidden="true" />
              FCC live · 3 s timeout
            </div>
          </section>
          <section className="card phone-limits">
            <h2 style={{ marginTop: 0 }}>Limits</h2>
            <span>Spoofed numbers can look clean or show the innocent owner.</span>
            <span>New telemarketer numbers may have no complaints yet.</span>
            <span>Many cell numbers have no registered name.</span>
            <span>Complaint data is unverified.</span>
          </section>
        </aside>
      </div>

      <section className="card phone-history">
        <div className="phone-history-head">
          <h2 style={{ margin: 0, flex: 1 }}>History · last 90 days</h2>
          <form action="/phone" method="get" className="phone-search">
            <input
              type="search"
              name="q"
              defaultValue={query}
              aria-label="Search history"
              placeholder="Search history"
            />
            {sel ? <input type="hidden" name="sel" value={sel} /> : null}
          </form>
        </div>
        <div className="phone-history-scroll">
          <div className="phone-history-grid phone-history-cols phone-history-header">
            <span>Number</span>
            <span>Verdict</span>
            <span>Name</span>
            <span>Looked up by</span>
            <span>Date</span>
          </div>
          {history.length === 0 ? (
            <p className="subtle" data-testid="phone-history-empty" style={{ padding: "10px 4px" }}>
              {query ? "No lookups match." : "No lookups yet."}
            </p>
          ) : null}
          {history.map((h) => (
            <HistoryRow key={h.phone} h={h} query={query} />
          ))}
        </div>
      </section>
    </>
  );
}

function EmptyResult() {
  return (
    <section className="card phone-result phone-result-empty" aria-label="Result">
      <p className="subtle" data-testid="phone-empty">
        Enter a number above to see whether it is likely a telemarketer, unclear, or a real person,
        with the reasons.
      </p>
    </section>
  );
}

function ResultCard({ r }: { r: LookupResult }) {
  const color = VERDICT_COLOR[r.verdict];
  const band = r.mark
    ? `Marked ${r.mark.label}`
    : r.verdict === "telemarketer"
      ? "Score " + r.score + " · 4 or more"
      : r.verdict === "unclear"
        ? "Score " + r.score + " · 2 to 3"
        : "Score " + r.score + " · 1 or less";
  return (
    <section className="card phone-result" aria-label="Result" data-testid="phone-result">
      <div className="phone-verdict" style={{ background: color }} data-testid="phone-verdict" data-verdict={r.verdict}>
        <div className="phone-verdict-text">
          <div className="phone-verdict-main">{r.verdictLabel}</div>
          <div className="phone-verdict-sub">{band}</div>
        </div>
        <span className="phone-verdict-num mono">{r.display}</span>
      </div>
      <div className="phone-result-body">
        <div className="phone-facts">
          <div>
            <span className="phone-fact-label">Caller name</span>
            <span className="phone-fact-val" data-testid="phone-caller">
              {r.callerName || "—"}
            </span>
          </div>
          <div>
            <span className="phone-fact-label">Line type</span>
            <span className="phone-fact-val">{lineLabel(r.lineType)}</span>
          </div>
          <div>
            <span className="phone-fact-label">Carrier</span>
            <span className="phone-fact-val">{r.carrier || "—"}</span>
          </div>
        </div>

        <div>
          <span className="phone-fact-label">Reasons</span>
          <ul className="phone-reasons" data-testid="phone-reasons">
            {r.reasons.length === 0 ? <li>No signals either way</li> : null}
            {r.reasons.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
        </div>

        <div className="phone-counts">
          <div className="phone-count-card">
            <span className="phone-fact-label">FTC complaints · 12 months</span>
            <span className="mono phone-count-num" data-testid="phone-ftc">
              {r.ftc.count}
            </span>
            <span className="phone-fact-label">
              {r.ftc.lastSeen ? `most recent ${formatShortDate(r.ftc.lastSeen)}` : "none on record"}
            </span>
          </div>
          <div className="phone-count-card">
            <span className="phone-fact-label">FCC complaints · 12 months</span>
            <span className="mono phone-count-num" data-testid="phone-fcc">
              {r.fcc.available ? r.fcc.count : "—"}
            </span>
            <span className="phone-fact-label">
              {!r.fcc.available
                ? "FCC data unavailable"
                : r.fcc.lastDate
                  ? `most recent ${formatShortDate(r.fcc.lastDate)}`
                  : "none on record"}
            </span>
          </div>
        </div>

        {r.mark ? (
          <div className="phone-actions">
            <span className="phone-mark-tag" data-testid="phone-mark">
              {r.verdictLabel}
              {r.mark.note ? ` — ${r.mark.note}` : ""}
            </span>
            <form action={unmarkAction}>
              <input type="hidden" name="phone" value={r.phone} />
              <button className="btn ghost" type="submit" data-testid="phone-unmark">
                Remove mark
              </button>
            </form>
            <form action={refreshAction}>
              <input type="hidden" name="phone" value={r.phone} />
              <button className="btn ghost" type="submit">
                Refresh (paid lookup)
              </button>
            </form>
            <CopyButton value={r.display} />
          </div>
        ) : (
          <div className="phone-actions">
            <form action={markAction} className="phone-mark-form">
              <input type="hidden" name="phone" value={r.phone} />
              <input
                type="text"
                name="note"
                aria-label="Optional note"
                placeholder="Optional note"
                className="phone-note"
              />
              <button className="btn danger" type="submit" name="label" value="spam" data-testid="phone-mark-spam">
                Mark spam
              </button>
              <button className="btn ok" type="submit" name="label" value="real" data-testid="phone-mark-real">
                Mark real
              </button>
            </form>
            <form action={refreshAction}>
              <input type="hidden" name="phone" value={r.phone} />
              <button className="btn ghost" type="submit">
                Refresh (paid lookup)
              </button>
            </form>
            <CopyButton value={r.display} />
          </div>
        )}

        <div className="phone-cache mono subtle" data-testid="phone-cache">
          {r.twilioCached
            ? `Twilio data cached ${r.twilioFetchedAt.slice(0, 10)} · free repeat lookups for 30 days`
            : `Twilio data fetched ${r.twilioFetchedAt.slice(0, 10)} · cached 30 days`}
        </div>
      </div>
    </section>
  );
}

function HistoryRow({ h, query }: { h: LookupRow; query: string }) {
  const detail = h.detail as { callerName?: string; display?: string; source?: string };
  const display = detail.display || formatPhone(h.phone);
  const name = detail.callerName || "—";
  // The stored verdict is the scored one; a current mark overrides it on display (handoff §8.4),
  // and a marked number shows a tag (mockup).
  const mark = getMark(h.phone);
  const verdictKey: Verdict = mark ? verdictForMark(mark.label) : verdictFromScore(h.score, getScoringConfig());
  const href = `/phone?sel=${h.phone}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
  return (
    <Link href={href} className="phone-history-grid phone-history-cols phone-history-row" data-testid="phone-history-row">
      <span className="mono">{display}</span>
      <span className="phone-history-verdict">
        <span className="phone-dot" style={{ background: VERDICT_COLOR[verdictKey] }} aria-hidden="true" />
        <span>{VERDICT_LABEL[verdictKey]}</span>
      </span>
      <span className="phone-history-name">
        {name}
        {mark ? (
          <span className="phone-mark-badge" data-testid="phone-history-mark">
            Marked {mark.label} by {displayName(mark.user)}
          </span>
        ) : null}
      </span>
      <span>
        {displayName(h.user)}
        {h.source === "shortcut" ? " · Shortcut" : ""}
      </span>
      <span className="mono subtle">{h.createdAt.slice(0, 10)}</span>
    </Link>
  );
}
