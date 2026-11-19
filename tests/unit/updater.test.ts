import { describe, it, expect } from "vitest";
import { runUpdate, type UpdaterOps, type SmokeResult } from "../../scripts/updater/core";

// Spec check 5: a simulated new merge is backed up, applied and smoke-checked; a simulated failing
// smoke check restores the previous version and database and records the alert.

type Recorder = {
  ops: UpdaterOps;
  calls: string[];
  alerts: { message: string; log: string }[];
  liveAfter: () => string | null;
};

function makeOps(opts: {
  live: string | null;
  latest: string | null;
  syncInProgress?: boolean;
  applyThrows?: boolean;
  readBackOk?: boolean;
  smoke?: SmokeResult;
}): Recorder {
  const calls: string[] = [];
  const alerts: { message: string; log: string }[] = [];
  let live = opts.live;
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
    },
    readBack: () => {
      calls.push("readBack");
      return opts.readBackOk === false
        ? { ok: false, detail: "missing table:users" }
        : { ok: true, detail: "ok" };
    },
    restart: () => calls.push("restart"),
    smoke: () => {
      calls.push("smoke");
      return opts.smoke ?? { ok: true, detail: "ok" };
    },
    restore: (h) => calls.push(`restore:${h.id}`),
    raiseAlert: (message, log) => {
      calls.push("raiseAlert");
      alerts.push({ message, log });
    },
    recordLive: (sha) => {
      calls.push(`recordLive:${sha}`);
      live = sha;
    },
  };
  return { ops, calls, alerts, liveAfter: () => live };
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
      "restart",
      "smoke",
      "recordLive:new222",
      expect.stringContaining("log:"),
    ]);
    expect(r.liveAfter()).toBe("new222");
  });

  it("rolls back and alerts when the smoke check fails, restoring the previous version and database", () => {
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
    // It did NOT record the broken merge as live.
    expect(r.calls.some((c) => c.startsWith("recordLive"))).toBe(false);
    expect(r.liveAfter()).toBe("old111");
    expect(r.alerts[0].message).toBe("Update failed, rolled back");
  });

  it("rolls back when apply throws (build/migrate failure)", () => {
    const r = makeOps({ live: "old111", latest: "new222", applyThrows: true });
    const out = runUpdate(r.ops);
    expect(out.status).toBe("rolled-back");
    if (out.status === "rolled-back") expect(out.failedStep).toBe("apply");
    expect(r.calls).toContain("restore:backup-1");
  });

  it("rolls back when the read-back of migration objects fails", () => {
    const r = makeOps({ live: "old111", latest: "new222", readBackOk: false });
    const out = runUpdate(r.ops);
    expect(out.status).toBe("rolled-back");
    if (out.status === "rolled-back") expect(out.failedStep).toBe("read-back");
    expect(r.calls).toContain("restore:backup-1");
  });
});
