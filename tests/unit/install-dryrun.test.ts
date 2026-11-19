import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Spec check 6: the install script has a dry-run mode, tested in CI. It must print the plan, exit
// 0, and change nothing.
describe("install-mac.sh --dry-run", () => {
  it("exits 0, announces no changes, and creates nothing", () => {
    const fakeHome = mkdtempSync(path.join(tmpdir(), "cc-home-"));
    const configDir = path.join(fakeHome, "Library", "Application Support", "CommandCenter");
    const script = path.join(process.cwd(), "scripts", "install-mac.sh");

    let out = "";
    let code = -1;
    try {
      out = execFileSync("sh", [script, "--dry-run"], {
        encoding: "utf8",
        env: { ...process.env, HOME: fakeHome, CC_CONFIG_DIR: configDir },
      });
      code = 0;
    } catch (e) {
      const err = e as { status?: number; stdout?: string };
      code = err.status ?? -1;
      out = err.stdout ?? "";
    }

    expect(code).toBe(0);
    expect(out).toContain("dry run");
    expect(out).toContain("nothing changed");
    // Nothing was created.
    expect(existsSync(configDir)).toBe(false);
    expect(existsSync(path.join(fakeHome, "Library", "LaunchAgents"))).toBe(false);

    rmSync(fakeHome, { recursive: true, force: true });
  });
});
