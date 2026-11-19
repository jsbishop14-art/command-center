// Client-safe Projects grid constants and types (handoff §2 item 3). Kept free of any server/db
// import so the client ProjectsGrid can use them; the server builder (projects.ts) imports these.

export type ProjectFilter = "all" | "deals" | "gc" | "software" | "personal_family";

export const PROJECT_FILTERS: { key: ProjectFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "deals", label: "Deals" },
  { key: "gc", label: "GC jobs" },
  { key: "software", label: "Software" },
  { key: "personal_family", label: "Personal · Family" },
];

export type ProjectCard = {
  key: string;
  group: string;
  filter: Exclude<ProjectFilter, "all">;
  source: string;
  name: string;
  status: string;
  now: string;
  next: string;
  due: string;
  money: string;
  href?: string;
};
