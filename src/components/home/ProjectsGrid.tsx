"use client";

import { useState } from "react";
import Link from "next/link";
import { PROJECT_FILTERS, type ProjectCard, type ProjectFilter } from "@/lib/deals/projects-view";

// The Projects grid (handoff §2 item 3, mockup Main.dc.html). Filters All, Deals, GC jobs, Software,
// Personal · Family. Each card shows group, source, name, status, Now, Next, Due, Money. The cards
// are already board-scoped on the server; filtering by group is client-side. Deal cards link to the
// deal panel. Personal/Family projects arrive with a later build, so that filter can be empty here.
export default function ProjectsGrid({ cards }: { cards: ProjectCard[] }) {
  const [filter, setFilter] = useState<ProjectFilter>("all");
  const shown = filter === "all" ? cards : cards.filter((c) => c.filter === filter);

  function CardInner({ c }: { c: ProjectCard }) {
    return (
      <>
        <div className="row">
          <span className="group">{c.group}</span>
          <span className="src mono subtle">{c.source}</span>
        </div>
        <div className="name">{c.name}</div>
        <div className="status subtle">{c.status}</div>
        <div className="proj-meta">
          <div><span className="k">Now</span><span className="v">{c.now}</span></div>
          <div><span className="k">Next</span><span className="v">{c.next}</span></div>
          <div><span className="k">Due</span><span className="v mono">{c.due}</span></div>
          <div><span className="k">Money</span><span className="v mono">{c.money}</span></div>
        </div>
      </>
    );
  }

  return (
    <section id="projects" aria-label="Projects" className="projects-section">
      <div className="projects-head">
        <h2>Projects</h2>
        <div role="group" aria-label="Filter" className="projects-filters">
          {PROJECT_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`kb-pill ${filter === f.key ? "on" : ""}`}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              data-testid={`project-filter-${f.key}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="projects-grid">
        {shown.length === 0 ? (
          <p className="subtle" data-testid="projects-empty">
            {filter === "personal_family"
              ? "Personal and Family projects arrive with a later build."
              : "No projects on this board."}
          </p>
        ) : null}
        {shown.map((c) =>
          c.href ? (
            <Link key={c.key} href={c.href} className="project-card" data-testid={`project-${c.key}`}>
              <CardInner c={c} />
            </Link>
          ) : (
            <div key={c.key} className="project-card" data-testid={`project-${c.key}`}>
              <CardInner c={c} />
            </div>
          ),
        )}
      </div>
    </section>
  );
}
