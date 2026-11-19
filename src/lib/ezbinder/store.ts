import { getDb } from "@/lib/db";
import type { ArSummary, EzbJob, EzbTask, GcPhase, TaskKind } from "./types";

// Database side of the EZ Binder cache (migration 0006). Home reads these tables so a change that
// arrives by webhook (about 10 seconds) or by the 90-minute sync is already in the database when
// the page renders (handoff §2, §7.3; spec §1). "Newest updated_at wins" is enforced on every
// upsert (handoff §7.2, spec §3). Single household, no AI.

// ---- app_settings helpers (shared key/value table from migration 0002) ----

export function getAppSetting(key: string): string | null {
  const r = getDb().prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return r?.value ?? null;
}

export function setAppSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value);
}

// ---- money (GET /summary/ar) ----

export function saveArSummary(s: ArSummary, fetchedAt: string): "saved" | "stale" {
  const cur = getArSummary();
  if (cur && cur.asOf > s.asOf) return "stale"; // a newer snapshot is already stored
  getDb()
    .prepare(
      `INSERT INTO ezb_money (id, open_ar_cents, received_week_cents, open_invoice_count, over_30_cents, as_of, fetched_at)
       VALUES (1, @open_ar, @received, @count, @over30, @as_of, @fetched)
       ON CONFLICT(id) DO UPDATE SET
         open_ar_cents = excluded.open_ar_cents, received_week_cents = excluded.received_week_cents,
         open_invoice_count = excluded.open_invoice_count, over_30_cents = excluded.over_30_cents,
         as_of = excluded.as_of, fetched_at = excluded.fetched_at`,
    )
    .run({
      open_ar: s.openArCents,
      received: s.receivedThisWeekCents,
      count: s.openInvoiceCount,
      over30: s.over30Cents,
      as_of: s.asOf,
      fetched: fetchedAt,
    });
  return "saved";
}

export type MoneyRow = ArSummary & { fetchedAt: string };

export function getArSummary(): MoneyRow | null {
  const r = getDb()
    .prepare("SELECT open_ar_cents, received_week_cents, open_invoice_count, over_30_cents, as_of, fetched_at FROM ezb_money WHERE id = 1")
    .get() as
    | {
        open_ar_cents: number;
        received_week_cents: number;
        open_invoice_count: number;
        over_30_cents: number;
        as_of: string;
        fetched_at: string;
      }
    | undefined;
  if (!r) return null;
  return {
    openArCents: r.open_ar_cents,
    receivedThisWeekCents: r.received_week_cents,
    openInvoiceCount: r.open_invoice_count,
    over30Cents: r.over_30_cents,
    asOf: r.as_of,
    fetchedAt: r.fetched_at,
  };
}

// ---- jobs ----

type JobRow = {
  job_id: string;
  name: string;
  phase: string;
  now_task: string;
  next_task: string;
  due: string | null;
  billed_cents: number;
  paid_cents: number;
  boards: string;
  updated_at: string;
};

function toJob(r: JobRow): EzbJob {
  let boards: string[] = ["josh"];
  try {
    const parsed = JSON.parse(r.boards);
    if (Array.isArray(parsed)) boards = parsed as string[];
  } catch {
    // keep the default
  }
  return {
    jobId: r.job_id,
    name: r.name,
    phase: r.phase as GcPhase,
    nowTask: r.now_task,
    nextTask: r.next_task,
    due: r.due,
    billedCents: r.billed_cents,
    paidCents: r.paid_cents,
    boards,
    updatedAt: r.updated_at,
  };
}

export function saveJob(j: EzbJob, fetchedAt: string): "saved" | "stale" {
  const cur = getDb().prepare("SELECT updated_at FROM ezb_jobs WHERE job_id = ?").get(j.jobId) as
    | { updated_at: string }
    | undefined;
  if (cur && cur.updated_at > j.updatedAt) return "stale";
  getDb()
    .prepare(
      `INSERT INTO ezb_jobs (job_id, name, phase, now_task, next_task, due, billed_cents, paid_cents, boards, updated_at, fetched_at)
       VALUES (@job_id, @name, @phase, @now_task, @next_task, @due, @billed, @paid, @boards, @updated, @fetched)
       ON CONFLICT(job_id) DO UPDATE SET
         name = excluded.name, phase = excluded.phase, now_task = excluded.now_task,
         next_task = excluded.next_task, due = excluded.due, billed_cents = excluded.billed_cents,
         paid_cents = excluded.paid_cents, boards = excluded.boards, updated_at = excluded.updated_at,
         fetched_at = excluded.fetched_at`,
    )
    .run({
      job_id: j.jobId,
      name: j.name,
      phase: j.phase,
      now_task: j.nowTask,
      next_task: j.nextTask,
      due: j.due,
      billed: j.billedCents,
      paid: j.paidCents,
      boards: JSON.stringify(j.boards),
      updated: j.updatedAt,
      fetched: fetchedAt,
    });
  return "saved";
}

export function listJobs(): EzbJob[] {
  return (getDb().prepare("SELECT * FROM ezb_jobs ORDER BY name").all() as JobRow[]).map(toJob);
}

// ---- tasks ----

type TaskRow = {
  task_id: string;
  job_id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  kind: string;
  completed: number;
  updated_at: string;
};

function toTask(r: TaskRow): EzbTask {
  return {
    taskId: r.task_id,
    jobId: r.job_id,
    name: r.name,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    kind: r.kind as TaskKind,
    completed: !!r.completed,
    updatedAt: r.updated_at,
  };
}

export function saveTask(t: EzbTask, fetchedAt: string): "saved" | "stale" {
  const cur = getDb().prepare("SELECT updated_at FROM ezb_tasks WHERE task_id = ?").get(t.taskId) as
    | { updated_at: string }
    | undefined;
  if (cur && cur.updated_at > t.updatedAt) return "stale";
  getDb()
    .prepare(
      `INSERT INTO ezb_tasks (task_id, job_id, name, starts_on, ends_on, kind, completed, updated_at, fetched_at)
       VALUES (@task_id, @job_id, @name, @starts, @ends, @kind, @completed, @updated, @fetched)
       ON CONFLICT(task_id) DO UPDATE SET
         job_id = excluded.job_id, name = excluded.name, starts_on = excluded.starts_on,
         ends_on = excluded.ends_on, kind = excluded.kind, completed = excluded.completed,
         updated_at = excluded.updated_at, fetched_at = excluded.fetched_at`,
    )
    .run({
      task_id: t.taskId,
      job_id: t.jobId,
      name: t.name,
      starts: t.startsOn,
      ends: t.endsOn,
      kind: t.kind,
      completed: t.completed ? 1 : 0,
      updated: t.updatedAt,
      fetched: fetchedAt,
    });
  return "saved";
}

export function listTasks(): EzbTask[] {
  return (getDb().prepare("SELECT * FROM ezb_tasks ORDER BY starts_on, task_id").all() as TaskRow[]).map(toTask);
}

export function tasksForJob(jobId: string): EzbTask[] {
  return (
    getDb().prepare("SELECT * FROM ezb_tasks WHERE job_id = ? ORDER BY starts_on, task_id").all(jobId) as TaskRow[]
  ).map(toTask);
}

// ---- sync bookkeeping ----

export type SyncState = { cursor: string | null; lastSync: string | null; lastWebhook: string | null };

export function getSyncState(): SyncState {
  const r = getDb().prepare("SELECT cursor, last_sync, last_webhook FROM ezb_sync WHERE id = 1").get() as
    | { cursor: string | null; last_sync: string | null; last_webhook: string | null }
    | undefined;
  return { cursor: r?.cursor ?? null, lastSync: r?.last_sync ?? null, lastWebhook: r?.last_webhook ?? null };
}

export function setSyncCursor(cursor: string, at: string): void {
  getDb().prepare("UPDATE ezb_sync SET cursor = ?, last_sync = ? WHERE id = 1").run(cursor, at);
}

export function setLastWebhook(at: string): void {
  getDb().prepare("UPDATE ezb_sync SET last_webhook = ? WHERE id = 1").run(at);
}
