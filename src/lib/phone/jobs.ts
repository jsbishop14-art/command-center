import { livePhone } from "./mode";
import { nowEastern, todayEastern } from "../kanban/time";
import { runBackfill, dailyIngest } from "./ftc";
import { pruneHistory } from "./store";

// Background FTC ingest + prune (handoff §8.3). Ordinary code, NO AI — the same unref'd-timer
// pattern as the EZ Binder 90-minute sync. It only arms on the Mac mini (livePhone); it is never
// started in CI or tests (nothing on the test path calls startPhoneJobs, and 24 hours never
// elapses). On start it kicks off the resumable 12-month backfill once; the daily pass re-pulls the
// current month, prunes FTC rows older than 12 months and lookup history older than 90 days.

const DAILY_MS = 24 * 60 * 60 * 1000;
const g = globalThis as unknown as {
  __ccPhoneTimer?: ReturnType<typeof setInterval>;
  __ccPhoneBackfillStarted?: boolean;
};

// The daily maintenance pass (handoff §8.3, §8.5). Also callable directly on the Mac mini.
export async function runPhoneDaily(now?: string): Promise<void> {
  const at = now ?? nowEastern();
  await dailyIngest(todayEastern(), at);
  pruneHistory(at);
}

export function startPhoneJobs(): void {
  if (!livePhone()) return;
  if (!g.__ccPhoneBackfillStarted) {
    g.__ccPhoneBackfillStarted = true;
    void runBackfill(todayEastern(), nowEastern()).catch(() => {
      // a failed backfill must not crash the server; it resumes from the saved cursor next time
    });
  }
  if (g.__ccPhoneTimer) return;
  g.__ccPhoneTimer = setInterval(() => {
    void runPhoneDaily().catch(() => {
      // a failed pass must not crash the server; the next pass retries
    });
  }, DAILY_MS);
  if (typeof g.__ccPhoneTimer.unref === "function") g.__ccPhoneTimer.unref();
}

export function stopPhoneJobs(): void {
  if (g.__ccPhoneTimer) {
    clearInterval(g.__ccPhoneTimer);
    g.__ccPhoneTimer = undefined;
  }
}
