import fs from "node:fs";
import path from "node:path";
import { listCommits } from "./github";
import type { UpdaterView } from "./state";

// The Command Center card shows which merge is live on the Mac mini and whether the last update rolled
// back (handoff §7.4 steps 7-8). The §7.4 updater (built in CC1) writes these two local files on the
// Mac mini; CC8 only reads them. Build sessions and CI have no Mac mini, so the files are absent and
// the card simply shows no "Live on Mac mini" line — correct for an unconnected machine. The paths
// match scripts/updater/ops.ts (CC_UPDATER_STATE / CC_ALERT_DIR), so tests can seed them.

function repoRoot(): string {
  return process.env.CC_REPO_DIR || process.cwd();
}
function stateFile(): string {
  return process.env.CC_UPDATER_STATE || path.join(repoRoot(), "data", "updater-state.json");
}
function alertDir(): string {
  return process.env.CC_ALERT_DIR || path.join(repoRoot(), "data", "alerts");
}

type UpdaterState = { liveMerge: string | null; prevSha?: string };

function readState(): UpdaterState {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), "utf8"));
  } catch {
    return { liveMerge: null };
  }
}

// The newest "Update failed, rolled back" alert the updater has raised, if any.
function latestRollback(): { at: string; message: string; log: string } | null {
  let dir: string;
  try {
    dir = alertDir();
    if (!fs.existsSync(dir)) return null;
  } catch {
    return null;
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();
  for (const f of files) {
    try {
      const a = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as {
        at: string;
        message: string;
        log: string;
      };
      if (typeof a.message === "string" && /rolled back/i.test(a.message)) {
        return { at: a.at, message: a.message, log: a.log };
      }
    } catch {
      // skip an unreadable alert file
    }
  }
  return null;
}

// What to show on the Command Center card (handoff §7.4). repo is the Command Center repo, used to
// look up the merge commit time for the "live" line.
export function updaterView(repo: string): UpdaterView {
  const state = readState();
  let live: UpdaterView["live"] = null;
  if (state.liveMerge) {
    const commit = listCommits(repo, "main").find((c) => c.sha === state.liveMerge);
    live = { merge: state.liveMerge, at: commit?.committedAt ?? null };
  }
  return { live, rolledBack: latestRollback() };
}
