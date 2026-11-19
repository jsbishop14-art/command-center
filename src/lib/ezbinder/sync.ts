import { nowEastern } from "@/lib/kanban/time";
import { getArSummary, getSchedule, getChanges } from "./client";
import { saveArSummary, saveJob, saveTask, setSyncCursor, getSyncState } from "./store";
import { runSlipRule } from "./proposals";

// The EZ Binder sync (handoff §7.3): the 90-minute safety-net pull that keeps money, jobs and the
// schedule current even if a webhook is missed (spec §1). Ordinary code, NO AI. It pulls
// GET /summary/ar, GET /schedule and walks GET /changes for the cursor, writes the cache with
// newest-updated_at-wins (handoff §7.2), then runs the slip rule over the refreshed schedule. Also
// run on demand by the Refresh button (handoff §5.2) and after a webhook is applied.

export type SyncResult = {
  at: string;
  money: boolean;
  jobs: number;
  tasks: number;
  proposals: number;
};

export async function ezbSync(opts?: { at?: string }): Promise<SyncResult> {
  const at = opts?.at ?? nowEastern();

  const ar = await getArSummary();
  const money = saveArSummary(ar, at) === "saved";

  const schedule = await getSchedule();
  let jobs = 0;
  for (const j of schedule.jobs) if (saveJob(j, at) === "saved") jobs++;
  let tasks = 0;
  for (const t of schedule.tasks) if (saveTask(t, at) === "saved") tasks++;

  // Advance the /changes cursor (the live path returns real entries; the stub returns none).
  const changes = await getChanges(getSyncState().cursor);
  setSyncCursor(changes.cursor, at);

  // Slip rule over the refreshed schedule (handoff §2.2). Runs whenever schedule data refreshes.
  const proposals = (await runSlipRule({ at })).length;

  return { at, money, jobs, tasks, proposals };
}
