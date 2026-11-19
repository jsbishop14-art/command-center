import type { Board } from "@/lib/kanban/types";
import { listDeals } from "./actions";
import { gcJobs, GC_PHASE_LABEL } from "./gcjobs";
import { estimateInfos } from "./estimates";
import { formatMoney } from "./view";
import { type ProjectCard, type ProjectFilter } from "./projects-view";

export { PROJECT_FILTERS, type ProjectCard, type ProjectFilter } from "./projects-view";

// The Projects grid on Home (handoff §2 item 3, spec §2). A card grid across sources with filters
// All, Deals, GC jobs, Software, Personal and Family. Each card shows group, source, name, status,
// Now (current task), Next, Due and Money. Board-scoped (handoff §1.3). In CC5: Deals come from
// Command Center with linked-estimate status from the EZ Binder stub; GC jobs come from the stub
// until CC6; Software shows "Coming in CC8". Archived deals are hidden (spec §3). No AI.

const DASH = "—";

export function buildProjects(board: Board): ProjectCard[] {
  const cards: ProjectCard[] = [];

  // Deals (Command Center, §3.3), with linked estimate status from the EZ Binder stub.
  for (const d of listDeals().filter((x) => x.boards.includes(board))) {
    const ests = estimateInfos(d.estimates);
    const estLine = ests.length
      ? ests.map((e) => `${e.id} ${e.status}`).join(", ")
      : "No linked estimates";
    cards.push({
      key: `deal-${d.id}`,
      group: "Deal",
      filter: "deals",
      source: "Command Center",
      name: d.name,
      status: d.stage,
      now: d.currentTask || DASH,
      next: d.nextAction || DASH,
      due: d.nextActionDate || DASH,
      money: formatMoney(d.value),
      href: `/deals?deal=${d.id}`,
    });
    // Keep the estimate status visible on the deal card via the Next line fallback when empty.
    if (!d.nextAction && ests.length) cards[cards.length - 1].next = estLine;
  }

  // GC jobs (EZ Binder, stub until CC6), grouped by computed phase.
  for (const j of gcJobs().filter((x) => x.boards.includes(board))) {
    cards.push({
      key: `gc-${j.id}`,
      group: `GC job · ${GC_PHASE_LABEL[j.phase]}`,
      filter: "gc",
      source: "EZ Binder · stub",
      name: j.name,
      status: GC_PHASE_LABEL[j.phase],
      now: j.nowTask || DASH,
      next: j.nextTask || DASH,
      due: j.due || DASH,
      money: j.money,
    });
  }

  // Software (build status on GitHub, §7.1) — arrives in CC8.
  cards.push({
    key: "software-cc",
    group: "Software",
    filter: "software",
    source: "GitHub · CC8",
    name: "Command Center",
    status: "Coming in CC8",
    now: DASH,
    next: DASH,
    due: DASH,
    money: DASH,
  });

  return cards;
}

export function filterProjects(cards: ProjectCard[], filter: ProjectFilter): ProjectCard[] {
  if (filter === "all") return cards;
  return cards.filter((c) => c.filter === filter);
}
