import "server-only";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { kanbanDir } from "./paths";

// Git backup of the kanban folder (handoff §4.10): a commit after every Sync (CC7), plus once an
// hour when something changed. The kanban folder is its own git repo on the Mac mini, separate from
// the command-center code repo. Build sessions never touch the real folder (handoff §7.5).

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: kanbanDir(), encoding: "utf8" });
}

export function isKanbanRepo(): boolean {
  return fs.existsSync(path.join(kanbanDir(), ".git"));
}

export function initKanbanRepo(): void {
  if (isKanbanRepo()) return;
  fs.mkdirSync(kanbanDir(), { recursive: true });
  git(["init", "-q"]);
  // A local identity so commits work headless; no network remote is configured.
  git(["config", "user.email", "command-center@local"]);
  git(["config", "user.name", "Command Center"]);
}

// True when the working tree has uncommitted changes.
export function kanbanDirty(): boolean {
  if (!isKanbanRepo()) return false;
  return git(["status", "--porcelain"]).trim().length > 0;
}

// Commit everything in the kanban folder. Returns true if a commit was made, false if nothing to
// commit or the folder is not a repo.
export function commitKanban(message: string): boolean {
  if (!isKanbanRepo()) return false;
  git(["add", "-A"]);
  if (!kanbanDirty() && git(["status", "--porcelain"]).trim().length === 0) {
    // Nothing staged/changed.
  }
  // `git diff --cached --quiet` exits non-zero when there is something staged.
  try {
    execFileSync("git", ["diff", "--cached", "--quiet"], { cwd: kanbanDir() });
    return false; // nothing staged -> nothing to commit
  } catch {
    // there are staged changes
  }
  git(["commit", "-q", "-m", message]);
  return true;
}

export function lastCommitSubject(): string | null {
  if (!isKanbanRepo()) return null;
  try {
    return git(["log", "-1", "--format=%s"]).trim();
  } catch {
    return null; // no commits yet
  }
}
