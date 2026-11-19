// Real operations for the Mac mini updater (handoff 7.4, CC12 spec §1). Ordinary code, no AI. These
// run on the Mac mini only; they are never exercised in CI (there is no Mac mini and no remote to
// pull). The pure orchestration in core.ts is what the tests cover.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { openDatabaseAt, dbPath } from "../../src/lib/db";
import { verifyObjects } from "../../src/lib/schema-check";
import { isSyncInProgress } from "../../src/lib/sync-lock";
import type {
  ApplyResult,
  BackupHandle,
  ReadBackResult,
  RestoreResult,
  SmokeResult,
  UpdaterOps,
  UpdateOutcome,
} from "./core";
import { stageBuild, activateBuild, restoreBuild, recoverToMain, type BuildOps } from "./build";

const REPO = process.env.CC_REPO_DIR || process.cwd();
const STATE_FILE = process.env.CC_UPDATER_STATE || path.join(REPO, "data", "updater-state.json");
const BACKUP_DIR = process.env.CC_BACKUP_DIR || path.join(REPO, "backups");
const ALERT_DIR = process.env.CC_ALERT_DIR || path.join(REPO, "data", "alerts");

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: REPO, encoding: "utf8" }).trim();
}

// Every `npm ci` keeps dev dependencies, so the tools the updater itself needs (tsx for migrate,
// smoke and the updater) stay installed (CC12 spec §1 "Dev tools needed on the Mac stay installed").
function npmCi(): void {
  execFileSync("npm", ["ci", "--include=dev"], { cwd: REPO, stdio: "inherit" });
}

function npm(args: string[]): void {
  execFileSync("npm", args, { cwd: REPO, stdio: "inherit" });
}

// Build-and-switch operations over the real filesystem (CC11 spec §1). The build runs with
// CC_DIST_DIR set so next.config.mjs writes to the staging dir, never the served .next.
const buildOps: BuildOps = {
  runBuild: (distDir) =>
    execFileSync("npm", ["run", "build"], {
      cwd: REPO,
      stdio: "inherit",
      env: { ...process.env, CC_DIST_DIR: distDir },
    }),
  exists: (p) => fs.existsSync(p),
  rm: (p) => fs.rmSync(p, { recursive: true, force: true }),
  rename: (from, to) => fs.renameSync(from, to),
};

export type UpdaterState = {
  liveMerge: string | null;
  liveTitle?: string | null;
  liveAt?: string | null;
  prevSha?: string;
  lastCheck?: { at: string; outcome: string; detail: string };
};

function readState(): UpdaterState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { liveMerge: null };
  }
}

function writeState(state: UpdaterState): void {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// Count the migrations recorded in the live database. The updater uses the change in this count
// across a pass to tell whether the update actually changed the database (a migration ran), which
// decides whether a rollback must touch the database at all (CC12 checks 3, 4).
function countMigrations(): number {
  const db = openDatabaseAt(dbPath());
  try {
    const row = db
      .prepare(
        "SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name='schema_migrations'",
      )
      .get() as { c: number };
    if (!row.c) return 0;
    return (db.prepare("SELECT COUNT(*) c FROM schema_migrations").get() as { c: number }).c;
  } catch {
    return 0;
  } finally {
    db.close();
  }
}

// The title and committer date of a merge commit, for the Settings "live version" line.
function mergeInfo(sha: string): { title: string; at: string } {
  try {
    const title = git(["log", "-1", "--format=%s", sha]);
    const at = git(["log", "-1", "--format=%cI", sha]);
    return { title, at };
  } catch {
    return { title: "", at: "" };
  }
}

// The newest [Merge] commit reachable from a ref (HEAD at install time, origin/main during a pass).
function latestMergeOn(ref: string): string | null {
  const sha = git(["log", ref, "--grep", "^\\[Merge\\]", "-n", "1", "--format=%H"]);
  return sha || null;
}

export function realOps(): UpdaterOps {
  // Baseline migration count captured at backup time; migrationApplied() compares against it so the
  // answer is right even if a migration ran before a later failure.
  let migrationsBaseline = 0;

  return {
    log: (m) => console.log(m),

    liveMerge: () => readState().liveMerge,

    latestMergeOnMain: () => {
      git(["fetch", "--quiet", "origin", "main"]);
      return latestMergeOn("origin/main");
    },

    syncInProgress: () => isSyncInProgress(),

    backup: (): BackupHandle => {
      const id = stamp();
      const dir = path.join(BACKUP_DIR, id);
      fs.mkdirSync(dir, { recursive: true });
      // Back up the database file (handoff 7.4 step 3).
      const db = dbPath();
      if (fs.existsSync(db)) fs.copyFileSync(db, path.join(dir, path.basename(db)));
      // Baseline the migration count so we can tell if this pass changes the database.
      migrationsBaseline = countMigrations();
      // Record the version to restore to.
      const prevSha = git(["rev-parse", "HEAD"]);
      writeState({ ...readState(), prevSha });
      // Commit the kanban folder (handoff 4.10; folder exists from CC2 on).
      const kanban = process.env.CC_KANBAN_DIR || path.join(REPO, "kanban");
      if (fs.existsSync(kanban)) {
        try {
          git(["add", kanban]);
          git(["commit", "-m", `kanban snapshot before update ${id} [skip ci]`]);
        } catch {
          // nothing to commit
        }
      }
      return { id };
    },

    apply: (targetSha): ApplyResult => {
      git(["checkout", "main"]);
      git(["pull", "--ff-only", "origin", "main"]);
      // Guard: we pulled the expected merge.
      const head = git(["rev-parse", "HEAD"]);
      if (head !== targetSha) {
        throw new Error(`HEAD ${head.slice(0, 8)} is not the expected merge ${targetSha.slice(0, 8)}`);
      }
      npmCi();
      // Build the new version into the staging dir; the served .next is untouched throughout, so
      // no request errors while the build runs (CC11 spec §1). The switch happens in activate().
      stageBuild(buildOps, REPO);
      npm(["run", "migrate"]);
      return { migrated: countMigrations() > migrationsBaseline };
    },

    migrationApplied: () => countMigrations() > migrationsBaseline,

    activate: () => activateBuild(buildOps, REPO),

    readBack: (): ReadBackResult => {
      const db = openDatabaseAt(dbPath());
      try {
        const check = verifyObjects(db);
        return {
          ok: check.ok,
          detail: check.ok
            ? `${check.present.length} objects present`
            : `missing ${check.missing.map((o) => `${o.type}:${o.name}`).join(", ")}`,
        };
      } finally {
        db.close();
      }
    },

    restart: () => {
      const cmd = process.env.CC_RESTART_CMD;
      if (!cmd) {
        console.log("updater: no CC_RESTART_CMD set; skipping restart (set it in the launchd job)");
        return;
      }
      execFileSync("/bin/sh", ["-c", cmd], { cwd: REPO, stdio: "inherit" });
    },

    smoke: (): SmokeResult => {
      try {
        execFileSync("npm", ["run", "smoke"], { cwd: REPO, stdio: "inherit" });
        return { ok: true, detail: "smoke passed" };
      } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : String(e) };
      }
    },

    restore: (handle, opts): RestoreResult => {
      // Put the previous build back as the served one (fast rename; no rebuild in place). If the
      // build never switched (apply failed before activate), the served .next was never touched and
      // this is a no-op.
      restoreBuild(buildOps, REPO);
      // Leave the repo ON MAIN pointing at the previous merge — never a detached HEAD — so the next
      // pass fetches and fast-forwards cleanly (CC12 check 6).
      const state = readState();
      if (state.prevSha) {
        recoverToMain(git, state.prevSha);
        try {
          npmCi();
        } catch {
          // best effort; the previous build artifacts are already restored above
        }
      }
      // The database is rolled back only when this update had already changed it (a migration ran).
      // Otherwise keys and sessions saved during the update stay (CC12 check 3).
      let databaseCopiedAside: string | null = null;
      if (opts.restoreDatabase) {
        const dir = path.join(BACKUP_DIR, handle.id);
        const db = dbPath();
        const backupFile = path.join(dir, path.basename(db));
        // Copy the CURRENT (migrated) database aside before overwriting it, and say where (check 4).
        if (fs.existsSync(db)) {
          const aside = path.join(dir, `db-before-rollback-${stamp()}${path.extname(db) || ".db"}`);
          fs.copyFileSync(db, aside);
          databaseCopiedAside = aside;
        }
        if (fs.existsSync(backupFile)) fs.copyFileSync(backupFile, db);
      }
      return { databaseCopiedAside };
    },

    raiseAlert: (message, log) => {
      fs.mkdirSync(ALERT_DIR, { recursive: true });
      const file = path.join(ALERT_DIR, `${stamp()}.json`);
      fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), message, log }, null, 2));
      console.error(`updater: ALERT — ${message}`);
    },

    recordLive: (sha) => {
      const info = mergeInfo(sha);
      writeState({ ...readState(), liveMerge: sha, liveTitle: info.title, liveAt: info.at });
    },
  };
}

// Record the current checked-out merge as the live version — used by the installer so the first
// updater pass after install does nothing when the code is already current (CC12 check 1). Reads the
// newest [Merge] reachable from HEAD.
export function recordLiveFromHead(): string | null {
  const sha = latestMergeOn("HEAD");
  if (!sha) return null;
  const info = mergeInfo(sha);
  writeState({ ...readState(), liveMerge: sha, liveTitle: info.title, liveAt: info.at });
  return sha;
}

// Record the result of a pass (the 3 AM run or the Check for updates now button) so Settings can
// show when the last check ran and how it went (CC12 spec §1, check 2).
export function recordCheck(outcome: UpdateOutcome): void {
  let detail: string;
  switch (outcome.status) {
    case "up-to-date":
      detail = "Already up to date.";
      break;
    case "deferred-sync":
      detail = "Deferred — a Sync was in progress.";
      break;
    case "updated":
      detail = `Updated to ${outcome.merge.slice(0, 8)}.`;
      break;
    case "rolled-back":
      detail = `Update failed at ${outcome.failedStep} and was rolled back: ${outcome.detail}`;
      break;
  }
  writeState({
    ...readState(),
    lastCheck: { at: new Date().toISOString(), outcome: outcome.status, detail },
  });
}
