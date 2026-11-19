import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { moneyTiles, jobMoney } from "@/lib/ezbinder/view";
import { listJobs, getArSummary } from "@/lib/ezbinder/store";
import { startEzbSync } from "@/lib/ezbinder/sync";
import MoneyTiles from "@/components/ezbinder/MoneyTiles";

export const dynamic = "force-dynamic";

// The Money screen (handoff §2 money tiles, left menu "Money"). Shows the four A/R tiles to the cent
// and the billed/paid per GC job, all from the EZ Binder cache. Read-only: the app never edits EZ
// Binder money records (CLAUDE §8, spec §3). No AI.

const PHASE_LABEL: Record<string, string> = {
  active: "Active",
  sold_not_started: "Sold, not started",
  punch: "Punch",
};

export default function MoneyPage() {
  const user = currentUser();
  if (!user) redirect("/signin");
  startEzbSync(); // arm the 90-minute safety-net poll (no-op in CI/dev where no sync is due)
  // Not board-scoped: Christine sees everything (handoff §1.1), and billed/paid is financial data,
  // not a board-filtered view like Projects. The A/R tiles are likewise global.
  const tiles = moneyTiles();
  const summary = getArSummary();
  const jobs = listJobs();

  return (
    <>
      <div className="screen-head">
        <h1>Money</h1>
        {summary ? <span className="subtle mono">as of {summary.asOf}</span> : null}
      </div>

      <MoneyTiles tiles={tiles} />

      <section className="card">
        <h2>GC jobs · billed / paid</h2>
        {jobs.length === 0 ? (
          <p className="subtle">No GC jobs from EZ Binder yet.</p>
        ) : (
          <table className="money-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Phase</th>
                <th>Billed / paid</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.jobId} data-testid={`money-job-${j.jobId}`}>
                  <td>
                    <Link href={`/home#projects`}>{j.name}</Link>
                  </td>
                  <td>{PHASE_LABEL[j.phase] ?? j.phase}</td>
                  <td className="mono">{jobMoney(j)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="subtle small">
          Read-only. The app never edits EZ Binder money records and makes no QuickBooks calls.
        </p>
      </section>
    </>
  );
}
