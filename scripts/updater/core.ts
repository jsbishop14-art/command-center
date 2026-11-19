// The Mac mini updater logic (handoff 7.4), written as pure orchestration over an injected set of
// operations so it can be tested without a Mac mini, git or the network (CC12 checks 1, 3, 4, 6).
// The real operations live in ops.ts; run.ts wires them together.
//
// Flow (handoff 7.4 steps 1-8):
//   1. a new [Merge] commit on main?         -> else up-to-date
//   2. wait until no Sync is in progress     -> else deferred
//   3. back up the database, commit kanban
//   4. pull, install (keeping dev tools), build the new version into a STAGING dir, migrate (the
//      served build is not touched, so no request errors while the build runs — CC11 spec §1)
//   5. read back the migrations' objects
//   6. switch the staged build in, restart and smoke-check
//   7. if 4, 5 or 6 fails: restore the previous build and leave the repo on main. The database is
//      rolled back ONLY if this update had already changed it (a migration ran) — and then the
//      current database is copied aside first and the alert names both (CC12 spec §1, checks 3, 4).
//   8. record which merge is live
//
// CC12: a failed update never loses data it did not have to. Without a migration the database is
// untouched, so keys and sessions saved during the update are kept (check 3). The repo is left on
// `main`, never detached, so the next pass starts cleanly (check 6).

export type SmokeResult = { ok: boolean; detail: string };
export type ReadBackResult = { ok: boolean; detail: string };
export type ApplyResult = { migrated: boolean };
export type RestoreResult = { databaseCopiedAside: string | null };

export interface BackupHandle {
  id: string;
}

export interface UpdaterOps {
  log(message: string): void;
  liveMerge(): string | null; // the merge commit sha currently live on the Mac mini
  latestMergeOnMain(): string | null; // newest [Merge] commit sha on origin/main after a fetch
  syncInProgress(): boolean;
  backup(): BackupHandle; // step 3
  apply(targetSha: string): ApplyResult; // step 4 — pull, install, build into staging, migrate (throws on failure)
  migrationApplied(): boolean; // did THIS pass change the database? (used when apply throws)
  readBack(): ReadBackResult; // step 5
  activate(): void; // step 6 — switch the staged build in (only after a successful build + read-back)
  restart(): void; // step 6
  smoke(): SmokeResult; // step 6
  // step 7 — restore the previous build and leave the repo on main. Roll the database back only when
  // restoreDatabase is true (a migration ran); when it does, copy the current database aside first
  // and return where it went so the alert can name it.
  restore(handle: BackupHandle, opts: { restoreDatabase: boolean }): RestoreResult;
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
    migrated: boolean,
  ): UpdateOutcome => {
    ops.log(`updater: ${failedStep} failed — rolling back: ${detail}`);
    const res = ops.restore(handle, { restoreDatabase: migrated });
    ops.restart();
    const dbNote = migrated
      ? `This update had changed the database (a migration ran), so the database was rolled back to` +
        ` the copy from the start of the update. The database as it stood just before the rollback` +
        ` was copied aside to ${res.databaseCopiedAside ?? "(no current database found)"}.`
      : `No migration ran in this update, so the database was left exactly as it is — keys, sessions` +
        ` and settings saved during the update are kept.`;
    ops.raiseAlert("Update failed, rolled back", `${failedStep}: ${detail}. ${dbNote}`);
    return { status: "rolled-back", failedStep, detail };
  };

  // Step 4
  let migrated = false;
  try {
    migrated = ops.apply(latest).migrated;
  } catch (e) {
    // The build may have failed before any migration (the common case, database untouched) or a
    // migration may have run before a later failure; migrationApplied() tells us which.
    return rollback("apply", e instanceof Error ? e.message : String(e), ops.migrationApplied());
  }

  // Step 5
  const read = ops.readBack();
  if (!read.ok) {
    return rollback("read-back", read.detail, migrated);
  }

  // Step 6 — switch the staged build in only now that the build and read-back have succeeded, then
  // restart onto it and smoke-check.
  ops.activate();
  ops.restart();
  const smoke = ops.smoke();
  if (!smoke.ok) {
    return rollback("smoke", smoke.detail, migrated);
  }

  // Step 8
  ops.recordLive(latest);
  ops.log(`updater: ${latest.slice(0, 8)} is live`);
  return { status: "updated", merge: latest };
}
