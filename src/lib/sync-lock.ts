import fs from "node:fs";
import path from "node:path";

// The updater never runs while a Sync is in progress (spec §3; Sync arrives in CC7 — the check is
// built now). A Sync run writes this lock file at its start and removes it at its end. CC1 provides
// the lock primitives and the updater's check; CC7 will call acquire/release around a real run.
export function syncLockPath(): string {
  const kanban = process.env.CC_KANBAN_DIR || path.join(process.cwd(), "kanban");
  return path.join(kanban, ".sync.lock");
}

export function isSyncInProgress(): boolean {
  return fs.existsSync(syncLockPath());
}

export function acquireSyncLock(runId: string): void {
  const p = syncLockPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ runId, at: new Date().toISOString() }));
}

export function releaseSyncLock(): void {
  const p = syncLockPath();
  if (fs.existsSync(p)) fs.rmSync(p);
}
