import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { startReconciler } from "@/lib/kanban/reconciler";
import { listProblems } from "@/lib/kanban/state";

export const dynamic = "force-dynamic";

// Problems view (handoff §4.9): files that failed frontmatter validation are listed here with the
// reason, not dropped. The reconciler keeps this list current.
export default function ProblemsPage() {
  const user = currentUser();
  if (!user) redirect("/signin");
  startReconciler();
  const problems = listProblems();

  return (
    <>
      <div className="card kb-top">
        <h1>Problems</h1>
        <Link className="kb-pill" href="/kanban">
          Back to board
        </Link>
      </div>
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
