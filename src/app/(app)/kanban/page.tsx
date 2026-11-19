import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getBoard } from "@/lib/prefs";
import { startReconciler } from "@/lib/kanban/reconciler";
import { readCardFile } from "@/lib/kanban/store";
import { getBoardView, problemsCount, projectOptions, searchCards, BOARD_BADGE, MEMBER } from "@/lib/kanban/view";
import { nowEastern } from "@/lib/kanban/time";
import { STAGE_LABEL, type Board, type Card } from "@/lib/kanban/types";
import QuickAdd from "@/components/kanban/QuickAdd";
import CardPanel from "@/components/kanban/CardPanel";
import { restoreAction } from "@/app/(app)/kanban/actions";

export const dynamic = "force-dynamic";

const AREAS = [
  { key: "all", label: "All" },
  { key: "business", label: "Business" },
  { key: "personal", label: "Personal" },
  { key: "family", label: "Family" },
];

function chipClass(area: string): string {
  return area === "personal" ? "kb-chip personal" : area === "family" ? "kb-chip family" : "kb-chip";
}

export default function KanbanPage({
  searchParams,
}: {
  searchParams: { area?: string; project?: string; card?: string; q?: string };
}) {
  const user = currentUser();
  if (!user) redirect("/signin");
  startReconciler();

  const board = getBoard(user.id, user.role) as Board;
  const now = nowEastern();
  const area = searchParams.area || "all";
  const project = searchParams.project || "all";
  const columns = getBoardView({ board, area, project }, now);
  const problems = problemsCount();
  const projects = projectOptions();

  // Preserve the active filters in each card link and in the area pills.
  const base = (over: Partial<{ area: string; project: string; card: string }>) => {
    const p = new URLSearchParams();
    const a = over.area ?? area;
    const pr = over.project ?? project;
    if (a && a !== "all") p.set("area", a);
    if (pr && pr !== "all") p.set("project", pr);
    if (over.card) p.set("card", over.card);
    const q = p.toString();
    return q ? `/kanban?${q}` : "/kanban";
  };

  let selected: Card | null = null;
  if (searchParams.card) {
    try {
      selected = readCardFile(searchParams.card);
    } catch {
      selected = null;
    }
  }

  const query = (searchParams.q || "").trim();
  const results = query ? searchCards(query) : null;

  return (
    <>
      <div className="card kb-top">
        <h1>Kanban</h1>
        <form action="/kanban" method="get" style={{ display: "flex", gap: 6 }}>
          <input type="search" name="q" defaultValue={query} placeholder="Search all cards" aria-label="Search cards" style={{ height: 36 }} />
          <button className="btn ghost" type="submit" style={{ height: 36 }}>
            Search
          </button>
        </form>
        <Link className="kb-link-problems" href="/kanban/problems" data-testid="problems-link">
          Problems <span className="kb-count">{problems}</span>
        </Link>
        <QuickAdd />
      </div>

      {results ? (
        <div className="card">
          <h2>Search: &ldquo;{query}&rdquo;</h2>
          <p className="subtle">
            {results.active.length} on the board, {results.archived.length} archived. Archived cards
            can be restored.
          </p>
          <div className="problems-list">
            {results.active.map((c) => (
              <div key={c.id} className="row" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Link href={base({ card: c.id })} className="file">
                  {c.id}
                </Link>
                <span style={{ flex: 1 }}>{c.title}</span>
                <span className="subtle mono">{STAGE_LABEL[c.stage]}</span>
              </div>
            ))}
            {results.archived.map((c) => (
              <div key={c.id} className="row" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className="file">{c.id}</span>
                <span style={{ flex: 1 }}>{c.title}</span>
                <span className="subtle mono">archived</span>
                <form action={restoreAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="btn ghost" type="submit" data-testid={`restore-${c.id}`} style={{ height: 32 }}>
                    Restore
                  </button>
                </form>
              </div>
            ))}
            {results.active.length === 0 && results.archived.length === 0 ? (
              <p data-testid="no-results">No cards match.</p>
            ) : null}
          </div>
          <Link href="/kanban" className="kb-pill" style={{ marginTop: 10 }}>
            Clear search
          </Link>
        </div>
      ) : null}

      <div className="card kb-filters">
        <span className="label">Area</span>
        {AREAS.map((a) => (
          <Link
            key={a.key}
            href={base({ area: a.key })}
            className={`kb-pill ${area === a.key ? "on" : ""} ${a.key === "personal" ? "area-personal" : a.key === "family" ? "area-family" : ""}`}
          >
            {a.label}
          </Link>
        ))}
        <span className="label" style={{ marginLeft: 12 }}>
          Project
        </span>
        <Link href={base({ project: "all" })} className={`kb-pill ${project === "all" ? "on" : ""}`}>
          All projects
        </Link>
        {projects.map((p) => (
          <Link key={p.slug} href={base({ project: p.slug })} className={`kb-pill ${project === p.slug ? "on" : ""}`}>
            {p.name}
          </Link>
        ))}
      </div>

      <div className="kb-layout">
        <div className="kb-board">
          {columns.map((col) => (
            <section key={col.stage} className="kb-col" aria-label={col.name}>
              <div className="head">
                <h2>{col.name}</h2>
                <span className="subtle mono">{col.count}</span>
              </div>
              <div className="hint">{col.hint}</div>
              {col.cards.map((c) => {
                const addedBy =
                  c.created_by === "claude" || c.created_by === "duet" ? MEMBER[c.created_by].label : null;
                return (
                  <Link
                    key={c.id}
                    href={base({ card: c.id })}
                    className={`kb-card ${selected?.id === c.id ? "selected" : ""}`}
                    data-testid="kb-card"
                  >
                    <div className="row">
                      <span className={chipClass(c.area)}>{c.area[0].toUpperCase() + c.area.slice(1)}</span>
                      <span style={{ flex: 1 }} />
                      {c.boards.map((b) => (
                        <span key={b} className="kb-badge" style={{ background: BOARD_BADGE[b].color }}>
                          {BOARD_BADGE[b].letter}
                        </span>
                      ))}
                    </div>
                    <div className="title">{c.title}</div>
                    {addedBy ? <div className="by">Added by {addedBy}</div> : null}
                    <div className="meta">
                      <span>{c.project ?? ""}</span>
                      <span className="mono">{c.stage === "waiting_on" ? c.waiting_since ?? "" : c.due ?? ""}</span>
                    </div>
                  </Link>
                );
              })}
            </section>
          ))}
        </div>

        {selected ? <CardPanel card={selected} backHref={base({})} /> : null}
      </div>
    </>
  );
}
