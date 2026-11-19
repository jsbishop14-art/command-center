// Real operations for the Mac mini updater (handoff 7.4). Ordinary code, no AI. These run on the
// Mac mini only; they are never exercised in CI (there is no Mac mini and no remote to pull). The
// pure orchestration in core.ts is what the tests cover.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { openDatabaseAt, dbPath } from "../../src/lib/db";
import { verifyObjects } from "../../src/lib/schema-check";
import { isSyncInProgress } from "../../src/lib/sync-lock";
import type { BackupHandle, ReadBackResult, SmokeResult, UpdaterOps } from "./core";
import { stageBuild, activateBuild, restoreBuild, type BuildOps } from "./build";

const REPO = process.env.CC_REPO_DIR || process.cwd();
const STATE_FILE = process.env.CC_UPDATER_STATE || path.join(REPO, "data", "updater-state.json");
const BACKUP_DIR = process.env.CC_BACKUP_DIR || path.join(REPO, "backups");
const ALERT_DIR = process.env.CC_ALERT_DIR || path.join(REPO, "data", "alerts");

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: REPO, encoding: "utf8" }).trim();
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

function readState(): { liveMerge: string | null; prevSha?: string } {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { liveMerge: null };
  }
}

function writeState(state: { liveMerge: string | null; prevSha?: string }): void {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function realOps(): UpdaterOps {
  return {
    log: (m) => console.log(m),

    liveMerge: () => readState().liveMerge,

    latestMergeOnMain: () => {
      git(["fetch", "--quiet", "origin", "main"]);
      const sha = git([
        "log",
        "origin/main",
        "--grep",
        "^\\[Merge\\]",
        "-n",
        "1",
        "--format=%H",
      ]);
      return sha || null;
    },

    syncInProgress: () => isSyncInProgress(),

    backup: (): BackupHandle => {
      const id = stamp();
      const dir = path.join(BACKUP_DIR, id);
      fs.mkdirSync(dir, { recursive: true });
      // Back up the database file (handoff 7.4 step 3).
      const db = dbPath();
      if (fs.existsSync(db)) fs.copyFileSync(db, path.join(dir, path.basename(db)));
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

    apply: (targetSha) => {
      git(["checkout", "main"]);
      git(["pull", "--ff-only", "origin", "main"]);
      // Guard: we pulled the expected merge.
      const head = git(["rev-parse", "HEAD"]);
      if (head !== targetSha) {
        throw new Error(`HEAD ${head.slice(0, 8)} is not the expected merge ${targetSha.slice(0, 8)}`);
      }
      npm(["ci"]);
      // Build the new version into the staging dir; the served .next is untouched throughout, so
      // no request errors while the build runs (CC11 spec §1). The switch happens in activate().
      stageBuild(buildOps, REPO);
      npm(["run", "migrate"]);
    },

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

    restore: (handle) => {
      // Put the previous build back as the served one (fast rename; no rebuild in place). If the
      // build never switched (apply failed before activate), the served .next was never touched and
      // this is a no-op.
      restoreBuild(buildOps, REPO);
      const state = readState();
      if (state.prevSha) {
        git(["checkout", "--force", state.prevSha]);
        try {
          npm(["ci"]);
        } catch {
          // best effort; the previous build artifacts are already restored above
        }
      }
      // Restore the database backup.
      const dir = path.join(BACKUP_DIR, handle.id);
      const db = dbPath();
      const backupFile = path.join(dir, path.basename(db));
      if (fs.existsSync(backupFile)) fs.copyFileSync(backupFile, db);
    },

    raiseAlert: (message, log) => {
      fs.mkdirSync(ALERT_DIR, { recursive: true });
      const file = path.join(ALERT_DIR, `${stamp()}.json`);
      fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), message, log }, null, 2));
      console.error(`updater: ALERT — ${message}`);
    },

    recordLive: (sha) => {
      writeState({ ...readState(), liveMerge: sha });
    },
  };
}
