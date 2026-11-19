import "server-only";
import { execFileSync } from "node:child_process";
import { runUpdate, type UpdaterOps } from "../../../scripts/updater/core";
import { readUpdaterState, recordCheck, type UpdaterState } from "../../../scripts/updater/ops";

// The Settings → Updates section (CC12 spec §1, check 2). It shows which version is live, when the
// last update check ran and how it went, and runs a check on command. The 3 AM scheduled pass and
// this button both write their result into the same updater state file (scripts/updater/ops.ts), so
// Settings always reflects the latest pass whoever ran it.

export type UpdatesStatus = {
  live: { merge: string; title: string; at: string } | null;
  lastCheck: { at: string; outcome: string; detail: string } | null;
};

export function getUpdatesStatus(): UpdatesStatus {
  const s = readUpdaterState();
  return {
    live: s.liveMerge
      ? { merge: s.liveMerge, title: s.liveTitle ?? "", at: s.liveAt ?? "" }
      : null,
    lastCheck: s.lastCheck ?? null,
  };
}

// Ops for the dev / CI / build-session path: there is no git remote to pull, so report the live
// version as the latest (→ "up to date") without touching git or the network. The update steps are
// never reached because runUpdate() short-circuits at step 1. Only the Mac mini (CC_UPDATER_LIVE=1)
// runs the real updater, which really fetches and updates.
function devOps(s: UpdaterState): UpdaterOps {
  const unreachable = (): never => {
    throw new Error("updater: the live update path runs only on the Mac mini (CC_UPDATER_LIVE=1)");
  };
  return {
    log: () => {},
    liveMerge: () => s.liveMerge,
    latestMergeOnMain: () => s.liveMerge, // same as live → up to date, no git/network
    syncInProgress: () => false,
    backup: unreachable,
    apply: unreachable,
    migrationApplied: () => false,
    readBack: () => ({ ok: true, detail: "" }),
    activate: () => {},
    restart: () => {},
    smoke: () => ({ ok: true, detail: "" }),
    restore: () => ({ databaseCopiedAside: null }),
    raiseAlert: () => {},
    recordLive: () => {},
  };
}

// Run one updater pass on command. On the Mac mini this spawns the real updater (which fetches and
// updates if there is a new merge), then reads back the result it recorded. Everywhere else it runs
// the pure runUpdate() over devOps so the button and its result wiring work without a git remote.
export function runCheckNow(): UpdatesStatus {
  if (process.env.CC_UPDATER_LIVE === "1") {
    try {
      // The pass records its own result as lastCheck; we read it below. A long build is possible,
      // so allow plenty of time. The app may restart at the end of a successful update.
      execFileSync("npm", ["run", "updater"], { stdio: "inherit", timeout: 20 * 60_000 });
    } catch {
      // A failed pass still records its lastCheck (rolled-back); fall through and show it.
    }
  } else {
    const outcome = runUpdate(devOps(readUpdaterState()));
    recordCheck(outcome);
  }
  return getUpdatesStatus();
}
