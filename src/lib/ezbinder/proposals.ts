import { getDb } from "@/lib/db";
import { nowEastern, todayEastern } from "@/lib/kanban/time";
import { postProposal } from "./client";
import { tasksForJob, listTasks } from "./store";
import { addDays, daysFrom } from "./dates";
import type { EzbTask } from "./types";

// Schedule-move proposals (handoff §2.2, spec §1). A proposal changes nothing in EZ Binder until
// Josh confirms the move there; each shows its source. Three sources: Josh (drags a bar), the slip
// rule (ordinary code, below) and Claude (CC7). The source is the X-EZB-Actor the proposal is sent
// under (handoff §7.2: josh, rule, claude). No AI in this module — the slip rule is ordinary code.

export type ProposalSource = "josh" | "rule" | "claude";
export type ProposalStatus = "proposed" | "confirmed" | "rejected";

export type Proposal = {
  id: number;
  jobId: string;
  taskId: string | null;
  source: ProposalSource;
  actor: string;
  fromStart: string | null;
  fromEnd: string | null;
  toStart: string;
  toEnd: string;
  note: string;
  status: ProposalStatus;
  ezbRef: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

type Row = {
  id: number;
  job_id: string;
  task_id: string | null;
  source: string;
  actor: string;
  from_start: string | null;
  from_end: string | null;
  to_start: string;
  to_end: string;
  note: string;
  status: string;
  ezb_ref: string | null;
  created_at: string;
  resolved_at: string | null;
};

function toProposal(r: Row): Proposal {
  return {
    id: r.id,
    jobId: r.job_id,
    taskId: r.task_id,
    source: r.source as ProposalSource,
    actor: r.actor,
    fromStart: r.from_start,
    fromEnd: r.from_end,
    toStart: r.to_start,
    toEnd: r.to_end,
    note: r.note,
    status: r.status as ProposalStatus,
    ezbRef: r.ezb_ref,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  };
}

export function listProposals(opts?: { status?: ProposalStatus; jobId?: string }): Proposal[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts?.status) {
    where.push("status = ?");
    params.push(opts.status);
  }
  if (opts?.jobId) {
    where.push("job_id = ?");
    params.push(opts.jobId);
  }
  const sql = `SELECT * FROM ezb_proposals ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id`;
  return (getDb().prepare(sql).all(...params) as Row[]).map(toProposal);
}

export function openProposals(): Proposal[] {
  return listProposals({ status: "proposed" });
}

export function getProposal(id: number): Proposal | null {
  const r = getDb().prepare("SELECT * FROM ezb_proposals WHERE id = ?").get(id) as Row | undefined;
  return r ? toProposal(r) : null;
}

export type CreateProposal = {
  jobId: string;
  taskId: string | null;
  source: ProposalSource;
  fromStart?: string | null;
  fromEnd?: string | null;
  toStart: string;
  toEnd: string;
  note?: string;
};

// Create a proposal: send it to EZ Binder (returns 202 with a reference), then store it as
// "proposed". Nothing in EZ Binder changes until Josh confirms the move there (handoff §2.2). The
// actor sent to EZ Binder is the source (josh, rule or claude).
export async function createProposal(input: CreateProposal, opts?: { at?: string }): Promise<Proposal> {
  const at = opts?.at ?? nowEastern();
  const receipt = await postProposal({
    jobId: input.jobId,
    taskId: input.taskId,
    toStart: input.toStart,
    toEnd: input.toEnd,
    actor: input.source,
    note: input.note,
  });
  const info = getDb()
    .prepare(
      `INSERT INTO ezb_proposals (job_id, task_id, source, actor, from_start, from_end, to_start, to_end, note, status, ezb_ref, created_at)
       VALUES (@job, @task, @source, @actor, @fromStart, @fromEnd, @toStart, @toEnd, @note, 'proposed', @ref, @at)`,
    )
    .run({
      job: input.jobId,
      task: input.taskId,
      source: input.source,
      actor: input.source,
      fromStart: input.fromStart ?? null,
      fromEnd: input.fromEnd ?? null,
      toStart: input.toStart,
      toEnd: input.toEnd,
      note: input.note ?? "",
      ref: receipt.ref,
      at,
    });
  return getProposal(Number(info.lastInsertRowid))!;
}

// Mark a proposal confirmed or rejected (handoff §2.2). Confirmation happens in EZ Binder; the
// dashboard learns of it through a webhook, or Josh rejects a proposal to clear it. Once resolved,
// the slip rule does not raise the same proposal again for that task (spec check 3).
export function resolveProposal(id: number, status: "confirmed" | "rejected", opts?: { at?: string }): Proposal {
  const at = opts?.at ?? nowEastern();
  getDb()
    .prepare("UPDATE ezb_proposals SET status = ?, resolved_at = ? WHERE id = ? AND status = 'proposed'")
    .run(status, at, id);
  return getProposal(id)!;
}

// Has the slip rule ever raised a proposal for this task? Any status counts: a proposed one is
// still open; a confirmed or rejected one must not be raised again (spec check 3).
function ruleProposalExists(taskId: string): boolean {
  const r = getDb()
    .prepare("SELECT 1 FROM ezb_proposals WHERE source = 'rule' AND task_id = ? LIMIT 1")
    .get(taskId);
  return !!r;
}

// The slip rule (handoff §2.2): when a task passes its end date without being completed, propose
// shifting the later tasks on that job by the same number of days. Ordinary code, no AI; runs
// whenever schedule data refreshes (sync, webhook, Refresh). Returns the proposals created this run.
export async function runSlipRule(opts?: { today?: string; at?: string }): Promise<Proposal[]> {
  const today = opts?.today ?? todayEastern();
  const at = opts?.at ?? nowEastern();
  const created: Proposal[] = [];
  for (const t of listTasks()) {
    if (t.completed) continue;
    const slip = daysFrom(t.endsOn, today); // calendar days past the task's end
    if (slip <= 0) continue;
    if (ruleProposalExists(t.taskId)) continue; // already raised — do not repeat (spec check 3)
    const later = laterTasks(t);
    if (later.length === 0) continue;
    const first = later[0];
    const prop = await createProposal(
      {
        jobId: t.jobId,
        taskId: t.taskId,
        source: "rule",
        fromStart: first.startsOn,
        fromEnd: first.endsOn,
        toStart: addDays(first.startsOn, slip),
        toEnd: addDays(first.endsOn, slip),
        note: `"${t.name}" ran ${slip} day(s) past its end; shift ${later.length} later task(s) by ${slip} day(s).`,
      },
      { at },
    );
    created.push(prop);
  }
  return created;
}

// Tasks on the same job that start after the overrunning task was due to end (the ones a slip would
// push). Ordered earliest first.
function laterTasks(t: EzbTask): EzbTask[] {
  return tasksForJob(t.jobId).filter((x) => x.taskId !== t.taskId && x.startsOn > t.endsOn);
}
