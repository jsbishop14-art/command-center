import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { useTempDb, TEST_SECRET_KEY } from "./helpers";
import { getDb } from "../../src/lib/db";
import { runMigrations } from "../../src/lib/migrations";
import { setSecret } from "../../src/lib/secrets";
import { ezbSync } from "../../src/lib/ezbinder/sync";
import { moneyTiles, scheduleGrid, formatCents } from "../../src/lib/ezbinder/view";
import { getArSummary, listTasks, saveArSummary, getSyncState } from "../../src/lib/ezbinder/store";
import { openProposals, runSlipRule, createProposal, resolveProposal } from "../../src/lib/ezbinder/proposals";
import { claimEvent, recordBadSignature, eventOutcome } from "../../src/lib/ezbinder/events";
import { verifySignature, signBody, applyEvent } from "../../src/lib/ezbinder/webhook";
import { stubArSummary } from "../../src/lib/ezbinder/stub";
import { POST as webhookPost } from "../../src/app/api/ezbinder/webhook/route";

// CC6 — EZ Binder connection, money and the GC schedule (spec §4; handoff §11 "EZ Binder and
// schedule"). Everything runs against the stub; no real outside call (spec §6). No AI, no QuickBooks.

function fresh() {
  process.env.CC_SECRET_KEY = TEST_SECRET_KEY;
  delete process.env.CC_LIVE_FEEDS;
  useTempDb();
  runMigrations(getDb());
  setSecret("ez_binder_webhook_secret", "whsec_test", "test");
}

const EZB_DIR = path.resolve(__dirname, "../../src/lib/ezbinder");

describe("CC6 money tiles (spec check: match GET /summary/ar to the cent)", () => {
  beforeEach(fresh);

  it("the cached summary equals the stub, to the cent", async () => {
    await ezbSync({ at: "2026-11-19T09:00:00-05:00" });
    const m = getArSummary()!;
    const stub = stubArSummary(m.asOf);
    expect(m.openArCents).toBe(stub.openArCents);
    expect(m.over30Cents).toBe(stub.over30Cents);
    expect(m.openInvoiceCount).toBe(stub.openInvoiceCount);
  });

  it("the tiles format cents without rounding away the pennies", async () => {
    await ezbSync();
    const tiles = moneyTiles()!;
    expect(tiles.find((t) => t.label === "Open A/R")!.value).toBe("$243,187.42");
    expect(tiles.find((t) => t.label === "Over 30 days")!.value).toBe("$98,650.10");
    expect(tiles.find((t) => t.label === "Open invoices")!.value).toBe("7");
    expect(formatCents(100)).toBe("$1.00");
    expect(formatCents(99)).toBe("$0.99");
  });

  it("money tiles are null before the first sync", () => {
    expect(moneyTiles()).toBeNull();
  });
});

describe("CC6 schedule and the slip rule (handoff §2.2, spec check 3)", () => {
  beforeEach(fresh);

  it("sync fills the schedule grid with the active and sold-not-started jobs only", async () => {
    await ezbSync();
    const grid = scheduleGrid({ today: new Date().toISOString().slice(0, 10) });
    expect(grid.hasData).toBe(true);
    const jobs = grid.rows.map((r) => r.jobId).sort();
    expect(jobs).toEqual(["JOB-5521", "JOB-5530"]); // punch job JOB-5490 is not scheduled
  });

  it("the slip rule proposes a shift for an overrunning task, with source 'rule'", async () => {
    await ezbSync();
    const props = openProposals().filter((p) => p.source === "rule");
    expect(props.length).toBe(1);
    expect(props[0].taskId).toBe("T-5521-1");
    expect(props[0].status).toBe("proposed");
    expect(props[0].ezbRef).toBeTruthy(); // EZ Binder returned a 202 reference
  });

  it("a rule proposal is not repeated for the same task on a later run", async () => {
    await ezbSync();
    const before = openProposals().length;
    const made = await runSlipRule();
    expect(made.length).toBe(0);
    expect(openProposals().length).toBe(before);
  });

  it("a rule proposal is not raised again once it is confirmed or rejected (spec check 3)", async () => {
    await ezbSync();
    const rule = openProposals().find((p) => p.source === "rule")!;
    resolveProposal(rule.id, "rejected");
    expect(openProposals().some((p) => p.id === rule.id)).toBe(false);
    const made = await runSlipRule();
    expect(made.length).toBe(0); // not recreated for T-5521-1
  });
});

describe("CC6 proposals change nothing in EZ Binder until confirmed (handoff §2.2, spec §3)", () => {
  beforeEach(fresh);

  it("a Josh move is stored as a proposal and leaves the task dates untouched", async () => {
    await ezbSync();
    const task = listTasks().find((t) => t.taskId === "T-5521-2")!;
    const prop = await createProposal({
      jobId: task.jobId,
      taskId: task.taskId,
      source: "josh",
      fromStart: task.startsOn,
      fromEnd: task.endsOn,
      toStart: "2026-12-01",
      toEnd: "2026-12-04",
    });
    expect(prop.status).toBe("proposed");
    expect(prop.source).toBe("josh");
    expect(prop.ezbRef).toBeTruthy();
    const after = listTasks().find((t) => t.taskId === "T-5521-2")!;
    expect(after.startsOn).toBe(task.startsOn); // unchanged in the cache (EZ Binder is unchanged)
    expect(after.endsOn).toBe(task.endsOn);
  });

  it("each source (josh, rule, claude) shows as a proposal with its source", async () => {
    await ezbSync();
    await createProposal({ jobId: "JOB-5521", taskId: "T-5521-3", source: "josh", toStart: "2026-12-05", toEnd: "2026-12-06" });
    await createProposal({ jobId: "JOB-5530", taskId: "T-5530-1", source: "claude", toStart: "2026-12-10", toEnd: "2026-12-12" });
    const sources = new Set(openProposals().map((p) => p.source));
    expect(sources.has("josh")).toBe(true);
    expect(sources.has("rule")).toBe(true);
    expect(sources.has("claude")).toBe(true);
  });
});

describe("CC6 webhook idempotency and signature (spec checks 1 and 2)", () => {
  beforeEach(fresh);

  it("claimEvent returns true once, then false for a repeat id", () => {
    const args = { eventId: "evt_1", kind: "webhook", entity: "task", updatedAt: null, at: "t" };
    expect(claimEvent(args)).toBe(true);
    expect(claimEvent(args)).toBe(false);
  });

  it("verifySignature accepts a correctly signed body and rejects a tampered one", () => {
    const raw = JSON.stringify({ id: "evt_x", type: "ar.summary.updated" });
    const sig = signBody(raw);
    expect(verifySignature(raw, sig)).toBe(true);
    expect(verifySignature(raw, sig.slice(0, -2) + "00")).toBe(false);
    expect(verifySignature(raw + " ", sig)).toBe(false);
    expect(verifySignature(raw, null)).toBe(false);
  });

  it("records a bad-signature refusal for the audit", () => {
    recordBadSignature("evt_forged", "t");
    expect(eventOutcome("evt_forged")).toBe("bad_signature");
  });

  it("the route refuses a bad signature with 401 and logs it (spec check 1)", async () => {
    const raw = JSON.stringify({ id: "evt_bad", type: "ar.summary.updated", data: {} });
    const res = await webhookPost(
      new Request("http://local/api/ezbinder/webhook", {
        method: "POST",
        body: raw,
        headers: { "x-ezb-signature": "deadbeef" },
      }),
    );
    expect(res.status).toBe(401);
    expect(eventOutcome("evt_bad")).toBe("bad_signature");
  });

  it("the same event delivered twice changes data once (spec check 2)", async () => {
    await ezbSync();
    const summary = { ...stubArSummary("2026-11-20T10:00:00-05:00"), openArCents: 50_000_00 };
    const body = JSON.stringify({ id: "evt_dup", type: "ar.summary.updated", updated_at: summary.asOf, data: summary });
    const headers = { "x-ezb-signature": signBody(body) };

    const first = await webhookPost(new Request("http://local/w", { method: "POST", body, headers }));
    expect((await first.json()).ok).toBe(true);
    expect(getArSummary()!.openArCents).toBe(50_000_00);

    // Tamper with the data but keep the same event id: a duplicate must not apply the new data.
    const body2 = JSON.stringify({ id: "evt_dup", type: "ar.summary.updated", updated_at: summary.asOf, data: { ...summary, openArCents: 999_999_00 } });
    const second = await webhookPost(new Request("http://local/w", { method: "POST", body: body2, headers: { "x-ezb-signature": signBody(body2) } }));
    expect((await second.json()).duplicate).toBe(true);
    expect(getArSummary()!.openArCents).toBe(50_000_00); // unchanged by the duplicate
  });
});

describe("CC6 newest updated_at wins and reaches Home (handoff §7.2, §2)", () => {
  beforeEach(fresh);

  it("an older summary never overwrites a newer one", async () => {
    await ezbSync();
    const newer = { ...stubArSummary("2026-11-25T00:00:00-05:00"), openArCents: 111 };
    expect(saveArSummary(newer, "t")).toBe("saved");
    const older = { ...stubArSummary("2026-11-01T00:00:00-05:00"), openArCents: 222 };
    expect(saveArSummary(older, "t")).toBe("stale");
    expect(getArSummary()!.openArCents).toBe(111);
  });

  it("a task-change webhook reaches the schedule grid (the ~10s path)", async () => {
    await ezbSync();
    const today = new Date().toISOString().slice(0, 10);
    const t = listTasks().find((x) => x.taskId === "T-5521-2")!;
    const moved = { ...t, startsOn: today, endsOn: today, updatedAt: "2026-12-01T00:00:00-05:00" };
    await applyEvent({ id: "evt_task", type: "task.updated", updated_at: moved.updatedAt, data: toWire(moved) }, "t");
    const after = listTasks().find((x) => x.taskId === "T-5521-2")!;
    expect(after.startsOn).toBe(today);
    const grid = scheduleGrid({ today });
    const row = grid.rows.find((r) => r.jobId === "JOB-5521")!;
    expect(row.bars.some((b) => b.title === "Rough electrical")).toBe(true);
  });

  it("the 90-minute sync is the safety net: it fills the cache and records last_sync", async () => {
    const r = await ezbSync({ at: "2026-11-19T09:00:00-05:00" });
    expect(r.jobs).toBeGreaterThan(0);
    expect(r.tasks).toBeGreaterThan(0);
    expect(getSyncState().lastSync).toBe("2026-11-19T09:00:00-05:00");
  });
});

describe("CC6 no QuickBooks and no AI anywhere in the EZ Binder code (spec §3, CLAUDE §8)", () => {
  it("no EZ Binder source references QuickBooks or an AI client", () => {
    // "claude" is a legitimate schedule-proposal actor value (handoff §7.2), so it is allowed as a
    // data literal. What must be absent is a QuickBooks call (spec §3) or an AI client import — the
    // Anthropic SDK (CLAUDE §8: nothing here calls Claude; proposals from Claude arrive in CC7).
    const files = fs.readdirSync(EZB_DIR).filter((f) => f.endsWith(".ts"));
    const forbidden = /quickbooks|intuit|\bqbo\b|anthropic/i;
    for (const f of files) {
      const code = fs
        .readFileSync(path.join(EZB_DIR, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      expect(forbidden.test(code), `${f} must not reference QuickBooks or an AI client`).toBe(false);
    }
  });
});

// Shape an EzbTask the way the webhook payload carries it (camelCase matches the client types).
function toWire(t: ReturnType<typeof listTasks>[number]) {
  return t;
}
