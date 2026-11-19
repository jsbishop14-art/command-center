import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Spec check 7: the pre-push hook refuses a push without [skip ci] unless ALLOW_CI=1. Tested with a
// temporary repo (CLAUDE §4: test with a temporary repo).
const HOOK = path.join(process.cwd(), "scripts", "hooks", "pre-push");
const ZERO = "0".repeat(40);

describe("pre-push hook", () => {
  let repo: string;

  function git(args: string[]): string {
    return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
  }

  function commit(message: string): string {
    writeFileSync(path.join(repo, "f.txt"), message);
    git(["add", "."]);
    git(["commit", "-m", message]);
    return git(["rev-parse", "HEAD"]);
  }

  // Run the hook as git would: ref lines on stdin. Returns the exit code.
  function runHook(sha: string, env: Record<string, string> = {}): number {
    try {
      execFileSync("sh", [HOOK], {
        cwd: repo,
        input: `refs/heads/main ${sha} refs/heads/main ${ZERO}\n`,
        env: { ...process.env, ...env },
        stdio: ["pipe", "pipe", "pipe"],
      });
      return 0;
    } catch (e) {
      return (e as { status?: number }).status ?? -1;
    }
  }

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), "cc-hook-"));
    git(["init", "-q"]);
    git(["config", "user.email", "t@test"]);
    git(["config", "user.name", "Test"]);
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("refuses a push whose tip commit lacks [skip ci]", () => {
    const sha = commit("ordinary change");
    expect(runHook(sha)).toBe(1);
  });

  it("allows it when ALLOW_CI=1 (the one deliberate CI run)", () => {
    const sha = commit("ordinary change");
    expect(runHook(sha, { ALLOW_CI: "1" })).toBe(0);
  });

  it("allows a push whose tip commit has [skip ci]", () => {
    const sha = commit("docs tweak [skip ci]");
    expect(runHook(sha)).toBe(0);
  });
});
