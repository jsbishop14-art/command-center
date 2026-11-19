import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runUpdate, type UpdaterOps, type SmokeResult } from "../../scripts/updater/core";
import { recoverToMain } from "../../scripts/updater/build";

// Spec checks 3 and 4 (and the CC11 build-and-switch ordering): a simulated new merge is backed up,
// applied and smoke-checked; a failing pass restores the previous build, and rolls the database back
// ONLY when a migration had run — copying the current database aside first and naming both in the
// alert.

type RestoreCall = { restoreDatabase: boolean };

type Recorder = {
  ops: UpdaterOps;
  calls: string[];
  alerts: { message: string; log: string }[];
  restores: RestoreCall[];
  liveAfter: () => string | null;
};

function makeOps(opts: {
  live: string | null;
  latest: string | null;
  syncInProgress?: boolean;
  applyThrows?: boolean;
  migrated?: boolean; // did the pass apply a migration?
  readBackOk?: boolean;
  smoke?: SmokeResult;
  asidePath?: string | null;
}): Recorder {
  const calls: string[] = [];
  const alerts: { message: string; log: string }[] = [];
  const restores: RestoreCall[] = [];
  let live = opts.live;
  const migrated = !!opts.migrated;
  const ops: UpdaterOps = {
    log: (m) => calls.push(`log:${m}`),
    liveMerge: () => live,
    latestMergeOnMain: () => opts.latest,
    syncInProgress: () => !!opts.syncInProgress,
    backup: () => {
      calls.push("backup");
      return { id: "backup-1" };
    },
    apply: (sha) => {
      calls.push(`apply:${sha}`);
      if (opts.applyThrows) throw new Error("npm build failed");
      return { migrated };
    },
    migrationApplied: () => migrated,
    readBack: () => {
      calls.push("readBack");
      return opts.readBackOk === false
        ? { ok: false, detail: "missing table:users" }
        : { ok: true, detail: "ok" };
    },
    activate: () => calls.push("activate"),
    restart: () => calls.push("restart"),
    smoke: () => {
      calls.push("smoke");
      return opts.smoke ?? { ok: true, detail: "ok" };
    },
    restore: (h, o) => {
      calls.push(`restore:${h.id}`);
      restores.push({ restoreDatabase: o.restoreDatabase });
      return {
        databaseCopiedAside: o.restoreDatabase ? opts.asidePath ?? "/backups/backup-1/db-aside.db" : null,
      };
    },
    raiseAlert: (message, log) => {
      calls.push("raiseAlert");
      alerts.push({ message, log });
    },
    recordLive: (sha) => {
      calls.push(`recordLive:${sha}`);
      live = sha;
    },
  };
  return { ops, calls, alerts, restores, liveAfter: () => live };
}

describe("Mac mini updater", () => {
  it("up to date when the latest merge is already live", () => {
    const r = makeOps({ live: "abc", latest: "abc" });
    const out = runUpdate(r.ops);
    expect(out.status).toBe("up-to-date");
    expect(r.calls).not.toContain("backup");
  });

  it("defers while a Sync is in progress (spec §3)", () => {
    const r = makeOps({ live: "abc", latest: "def", syncInProgress: true });
    const out = runUpdate(r.ops);
    expect(out.status).toBe("deferred-sync");
    expect(r.calls).not.toContain("backup");
  });

  it("backs up, applies, reads back, restarts, smoke-checks, records live on success", () => {
    const r = makeOps({ live: "old111", latest: "new222" });
    const out = runUpdate(r.ops);
    expect(out).toEqual({ status: "updated", merge: "new222" });
    expect(r.calls).toEqual([
      expect.stringContaining("log:"),
      "backup",
      expect.stringContaining("log:"),
      "apply:new222",
      "readBack",
      "activate",
      "restart",
      "smoke",
      "recordLive:new222",
      expect.stringContaining("log:"),
    ]);
    expect(r.liveAfter()).toBe("new222");
  });

  it("switches the staged build in only after a successful build and read-back (CC11 build-and-switch)", () => {
    const r = makeOps({ live: "old111", latest: "new222" });
    runUpdate(r.ops);
    const applyAt = r.calls.indexOf("apply:new222");
    const readAt = r.calls.indexOf("readBack");
    const activateAt = r.calls.indexOf("activate");
    const restartAt = r.calls.indexOf("restart");
    expect(applyAt).toBeGreaterThanOrEqual(0);
    expect(activateAt).toBeGreaterThan(readAt);
    expect(readAt).toBeGreaterThan(applyAt);
    expect(restartAt).toBeGreaterThan(activateAt);
  });

  it("does not switch the build when the build (apply) fails — the served version is untouched", () => {
    const r = makeOps({ live: "old111", latest: "new222", applyThrows: true });
    const out = runUpdate(r.ops);
    expect(out.status).toBe("rolled-back");
    expect(r.calls).not.toContain("activate");
  });

  it("rolls back and alerts when the smoke check fails, restoring the previous build", () => {
    const r = makeOps({
      live: "old111",
      latest: "new222",
      smoke: { ok: false, detail: "Home did not load" },
    });
    const out = runUpdate(r.ops);
    expect(out).toEqual({
      status: "rolled-back",
      failedStep: "smoke",
      detail: "Home did not load",
    });
    expect(r.calls).toContain("restore:backup-1");
    expect(r.calls).toContain("raiseAlert");
    expect(r.calls.some((c) => c.startsWith("recordLive"))).toBe(false);
    expect(r.liveAfter()).toBe("old111");
    expect(r.alerts[0].message).toBe("Update failed, rolled back");
  });

  // CC12 check 3: a failed smoke with NO migration leaves the database untouched.
  it("does NOT roll the database back when no migration ran (keys/sessions kept)", () => {
    const r = makeOps({
      live: "old111",
      latest: "new222",
      migrated: false,
      smoke: { ok: false, detail: "Home did not load" },
    });
    const out = runUpdate(r.ops);
    expect(out.status).toBe("rolled-back");
    expect(r.restores).toEqual([{ restoreDatabase: false }]);
    expect(r.alerts[0].log).toContain("No migration ran");
    expect(r.alerts[0].log).toContain("kept");
  });

  // CC12 check 4: a failed update AFTER a migration rolls the database back, copying the current one
  // aside first, and the alert names both.
  it("rolls the database back when a migration ran, copying the current database aside and naming both", () => {
    const r = makeOps({
      live: "old111",
      latest: "new222",
      migrated: true,
      smoke: { ok: false, detail: "Home did not load" },
      asidePath: "/backups/backup-1/db-before-rollback.db",
    });
    const out = runUpdate(r.ops);
    expect(out.status).toBe("rolled-back");
    expect(r.restores).toEqual([{ restoreDatabase: true }]);
    expect(r.alerts[0].log).toContain("a migration ran");
    expect(r.alerts[0].log).toContain("/backups/backup-1/db-before-rollback.db");
  });

  it("rolls back when apply throws, consulting migrationApplied() for the database (none ran here)", () => {
    const r = makeOps({ live: "old111", latest: "new222", applyThrows: true, migrated: false });
    const out = runUpdate(r.ops);
    expect(out.status).toBe("rolled-back");
    if (out.status === "rolled-back") expect(out.failedStep).toBe("apply");
    expect(r.calls).toContain("restore:backup-1");
    expect(r.restores).toEqual([{ restoreDatabase: false }]);
  });

  it("rolls back when the read-back of migration objects fails", () => {
    const r = makeOps({ live: "old111", latest: "new222", readBackOk: false });
    const out = runUpdate(r.ops);
    expect(out.status).toBe("rolled-back");
    if (out.status === "rolled-back") expect(out.failedStep).toBe("read-back");
    expect(r.calls).toContain("restore:backup-1");
  });
});

// CC12 check 6: after a rollback the repo is on `main` (never a detached HEAD), so the next
// `git checkout main` + `pull --ff-only` fast-forwards cleanly. Run against a real temporary git
// repo so the actual git behaviour is proven, not mocked.
describe("recoverToMain leaves the repo on main (check 6)", () => {
  it("returns from a detached HEAD to main at the previous merge", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cc-git-"));
    const git = (args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
    try {
      git(["init", "-q", "-b", "main"]);
      git(["config", "user.email", "t@t"]);
      git(["config", "user.name", "t"]);
      writeFileSync(path.join(dir, "a"), "1");
      git(["add", "."]);
      git(["commit", "-q", "-m", "[Merge] CC11 ("]);
      const prevSha = git(["rev-parse", "HEAD"]);
      // A newer commit on main, then detach HEAD onto it — the broken state the old updater left.
      writeFileSync(path.join(dir, "a"), "2");
      git(["add", "."]);
      git(["commit", "-q", "-m", "[Merge] CC12 ("]);
      const newSha = git(["rev-parse", "HEAD"]);
      git(["checkout", "-q", newSha]); // detached HEAD
      expect(() => git(["symbolic-ref", "HEAD"])).toThrow(); // confirm detached

      recoverToMain(git, prevSha);

      // On main again, at the previous merge.
      expect(git(["symbolic-ref", "HEAD"])).toBe("refs/heads/main");
      expect(git(["rev-parse", "HEAD"])).toBe(prevSha);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
