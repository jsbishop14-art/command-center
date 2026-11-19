import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { startReconciler } from "@/lib/kanban/reconciler";
import { listProblems } from "@/lib/kanban/state";
import { listFeedProblems } from "@/lib/feeds/google";
import { googleConnectHref } from "@/lib/feeds/connect-url";

export const dynamic = "force-dynamic";

// Problems view (handoff §4.9, CC11 spec §1): files that failed frontmatter validation, and Google
// connections that expired or were revoked, are listed here with the reason — not dropped, and not
// failing quietly. The reconciler keeps the card-file list current; a feed problem offers Reconnect.
export default function ProblemsPage() {
  const user = currentUser();
  if (!user) redirect("/signin");
  startReconciler();
  const problems = listProblems();
  const feedProblems = listFeedProblems();

  return (
    <>
      <div className="card kb-top">
        <h1>Problems</h1>
        <Link className="kb-pill" href="/kanban">
          Back to board
        </Link>
      </div>
      {feedProblems.length > 0 ? (
        <div className="card">
          <h2>Connections</h2>
          <p className="subtle">
            A Google sign-in that expired or was revoked. The feed stops updating until you
            reconnect — click Reconnect to sign in again.
          </p>
          <div className="problems-list" data-testid="feed-problems">
            {feedProblems.map((p) => (
              <div key={p.target} className="row" data-testid={`feed-problem-${p.target}`}>
                <div className="file">{p.label}</div>
                <div className="subtle">{p.reason}</div>
                <a className="btn ghost" href={googleConnectHref(p.target)} data-testid={`reconnect-${p.target}`}>
                  Reconnect
                </a>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="card">
        <p className="subtle">
          Files in the kanban folder that could not be read. They are kept in place, not dropped —
          fix the file and it leaves this list within a couple of seconds.
        </p>
        {problems.length === 0 ? (
          <p data-testid="no-problems">No problems. Every card file reads cleanly.</p>
        ) : (
          <div className="problems-list">
            {problems.map((p) => (
              <div key={p.file} className="row">
                <div className="file">{p.file}</div>
                <div className="subtle">{p.reason}</div>
                <div className="when mono subtle">{p.at}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
