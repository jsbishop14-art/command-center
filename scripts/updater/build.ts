// Build-and-switch for the Mac mini updater (CC11 spec §1, handoff 7.4). The updater must build the
// new version WITHOUT replacing the one being served, then switch and restart — so no request gets
// an internal error while an update is building. This is the pure orchestration over an injected
// filesystem so it can be tested without a real build (check 8); the real operations are wired in
// ops.ts.
//
// Layout: the app serves from LIVE_DIR (.next). A new build goes into STAGING_DIR (.next-staging),
// built with CC_DIST_DIR pointing there (next.config.mjs reads it). On success the live build is
// kept as PREV_DIR (.next-prev) for rollback and staging becomes live. A failed build leaves LIVE
// untouched.

import path from "node:path";

export const LIVE_DIR = ".next";
export const STAGING_DIR = ".next-staging";
export const PREV_DIR = ".next-prev";

export interface BuildOps {
  runBuild(distDir: string): void; // build into distDir; throws on failure
  exists(p: string): boolean;
  rm(p: string): void; // remove a directory (recursive)
  rename(from: string, to: string): void;
}

// Build into the staging dir. The live dir is never touched here, so the running app keeps serving
// the old build throughout (which can take minutes). On failure the staging dir is cleaned up and
// the error is rethrown, leaving the live dir exactly as it was.
export function stageBuild(ops: BuildOps, repo: string): void {
  const staging = path.join(repo, STAGING_DIR);
  if (ops.exists(staging)) ops.rm(staging);
  try {
    ops.runBuild(STAGING_DIR);
  } catch (e) {
    if (ops.exists(staging)) ops.rm(staging);
    throw e;
  }
}

// Switch the staged build to live: move the current live build aside to PREV (for rollback), then
// move staging into place. Two quick renames, done right before the restart.
export function activateBuild(ops: BuildOps, repo: string): void {
  const live = path.join(repo, LIVE_DIR);
  const staging = path.join(repo, STAGING_DIR);
  const prev = path.join(repo, PREV_DIR);
  if (!ops.exists(staging)) throw new Error("no staged build to activate");
  if (ops.exists(prev)) ops.rm(prev);
  if (ops.exists(live)) ops.rename(live, prev);
  ops.rename(staging, live);
}

// Roll the live build back to the previous one (used when the smoke check fails after a switch).
// If there is no previous build to restore, leave things as they are.
export function restoreBuild(ops: BuildOps, repo: string): void {
  const live = path.join(repo, LIVE_DIR);
  const prev = path.join(repo, PREV_DIR);
  if (!ops.exists(prev)) return;
  if (ops.exists(live)) ops.rm(live);
  ops.rename(prev, live);
}
