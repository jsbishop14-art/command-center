// The Mac mini updater logic (handoff 7.4), written as pure orchestration over an injected set of
// operations so it can be tested without a Mac mini, git or the network (spec check 5). The real
// operations live in ops.ts; run.ts wires them together.
//
// Flow (handoff 7.4 steps 1-8):
//   1. a new [Merge] commit on main?         -> else up-to-date
//   2. wait until no Sync is in progress     -> else deferred
//   3. back up the database, commit kanban
//   4. pull, install, build, migrate
//   5. read back the migrations' objects
//   6. restart and smoke-check
//   7. if 4, 5 or 6 fails: restore previous version + database, restart, raise a red alert
//   8. record which merge is live

export type SmokeResult = { ok: boolean; detail: string };
export type ReadBackResult = { ok: boolean; detail: string };

export interface BackupHandle {
  id: string;
}

export interface UpdaterOps {
  log(message: string): void;
  liveMerge(): string | null; // the merge commit sha currently live on the Mac mini
  latestMergeOnMain(): string | null; // newest [Merge] commit sha on origin/main after a fetch
  syncInProgress(): boolean;
  backup(): BackupHandle; // step 3
  apply(targetSha: string): void; // step 4 (throws on failure)
  readBack(): ReadBackResult; // step 5
  restart(): void; // step 6
  smoke(): SmokeResult; // step 6
  restore(handle: BackupHandle): void; // step 7
  raiseAlert(message: string, log: string): void; // step 7
  recordLive(sha: string): void; // step 8
}

export type UpdateOutcome =
  | { status: "up-to-date"; live: string | null }
  | { status: "deferred-sync" }
  | { status: "updated"; merge: string }
  | { status: "rolled-back"; failedStep: "apply" | "read-back" | "smoke"; detail: string };

export function runUpdate(ops: UpdaterOps): UpdateOutcome {
  const live = ops.liveMerge();
  const latest = ops.latestMergeOnMain();

  // Step 1
  if (!latest || latest === live) {
    ops.log("updater: up to date");
    return { status: "up-to-date", live };
  }
  ops.log(`updater: new merge ${latest.slice(0, 8)} (live ${live ? live.slice(0, 8) : "none"})`);

  // Step 2
  if (ops.syncInProgress()) {
    ops.log("updater: a Sync is in progress; deferring");
    return { status: "deferred-sync" };
  }

  // Step 3
  const handle = ops.backup();
  ops.log(`updater: backed up (${handle.id})`);

  const rollback = (
    failedStep: "apply" | "read-back" | "smoke",
    detail: string,
  ): UpdateOutcome => {
    ops.log(`updater: ${failedStep} failed — rolling back: ${detail}`);
    ops.restore(handle);
    ops.restart();
    ops.raiseAlert("Update failed, rolled back", `${failedStep}: ${detail}`);
    return { status: "rolled-back", failedStep, detail };
  };

  // Step 4
  try {
    ops.apply(latest);
  } catch (e) {
    return rollback("apply", e instanceof Error ? e.message : String(e));
  }

  // Step 5
  const read = ops.readBack();
  if (!read.ok) {
    return rollback("read-back", read.detail);
  }

  // Step 6
  ops.restart();
  const smoke = ops.smoke();
  if (!smoke.ok) {
    return rollback("smoke", smoke.detail);
  }

  // Step 8
  ops.recordLive(latest);
  ops.log(`updater: ${latest.slice(0, 8)} is live`);
  return { status: "updated", merge: latest };
}
