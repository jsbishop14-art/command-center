import { getSetting, setSetting } from "@/lib/kanban/state";
import { DEFAULT_PROJECTS } from "./stub";
import type { Project } from "./types";

// Tracked projects (handoff §7.1: "Each entry in Settings is a name and its GitHub repo; the list is
// editable"). Stored as JSON in app_settings — a local setting, not a GitHub write. Until Josh edits
// it, the six default projects stand (DEFAULT_PROJECTS, matching the stub). Editing the list is how
// he adds a new project or points one at a different repo; it is the only project state the app owns.
export const PROJECTS_SETTING = "builds_projects";

export function listProjects(): Project[] {
  const raw = getSetting(PROJECTS_SETTING);
  if (!raw) return DEFAULT_PROJECTS;
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return DEFAULT_PROJECTS;
    const out = v
      .map((e) =>
        e && typeof e === "object" && typeof e.name === "string" && typeof e.repo === "string"
          ? { name: e.name.trim(), repo: e.repo.trim() }
          : null,
      )
      .filter((e): e is Project => e !== null && e.name.length > 0 && e.repo.length > 0);
    return out.length > 0 ? out : DEFAULT_PROJECTS;
  } catch {
    return DEFAULT_PROJECTS;
  }
}

export function setProjects(projects: Project[]): void {
  const clean = projects
    .map((p) => ({ name: p.name.trim(), repo: p.repo.trim() }))
    .filter((p) => p.name.length > 0 && p.repo.length > 0);
  setSetting(PROJECTS_SETTING, JSON.stringify(clean));
}
