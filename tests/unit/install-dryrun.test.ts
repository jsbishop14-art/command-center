import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
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

// CC11 spec check 7: a dry run in a fake HOME whose settings path contains a SPACE prints a quoted
// env file that sources cleanly, both launchd jobs carry PATH and log paths, and the Cloudflare
// tunnel job is written only when ~/.cloudflared/config.yml exists.
describe("install-mac.sh --dry-run (CC11: spaced path, PATH/logs, tunnel)", () => {
  const script = path.join(process.cwd(), "scripts", "install-mac.sh");

  function dryRun(home: string): string {
    const configDir = path.join(home, "Library", "Application Support", "CommandCenter");
    try {
      return execFileSync("sh", [script, "--dry-run"], {
        encoding: "utf8",
        env: { ...process.env, HOME: home, CC_CONFIG_DIR: configDir },
      });
    } catch (e) {
      const err = e as { status?: number; stdout?: string };
      throw new Error(`installer exited ${err.status}: ${err.stdout}`);
    }
  }

  function envBlock(out: string): string {
    const lines = out.split("\n");
    const begin = lines.findIndex((l) => /^--- begin .*\/env ---$/.test(l));
    const end = lines.findIndex((l) => /^--- end .*\/env ---$/.test(l));
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(begin);
    return lines.slice(begin + 1, end).join("\n");
  }

  it("writes a quoted env file that sources cleanly despite the space, with PATH and log paths", () => {
    const home = path.join(mkdtempSync(path.join(tmpdir(), "cc-home-")), "with space");
    mkdirSync(home, { recursive: true });
    const out = dryRun(home);

    // The env values are quoted.
    const env = envBlock(out);
    expect(env).toMatch(/CC_SECRET_KEY="/);
    expect(env).toMatch(/CC_DB_PATH="[^"]*with space[^"]*"/);

    // It sources cleanly in /bin/sh even though the path has a space.
    const envFile = path.join(home, "env.test");
    writeFileSync(envFile, env + "\n");
    const srcOut = execFileSync("sh", ["-c", `set -a; . "${envFile}"; printf '%s' "$CC_DB_PATH"`], {
      encoding: "utf8",
    });
    expect(srcOut).toContain("with space");

    // Both launchd jobs carry PATH and write logs.
    expect((out.match(/<key>PATH<\/key>/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(out).toContain("app.log");
    expect(out).toContain("updater.log");

    // No tunnel job is written when there is no config.yml.
    expect(out).not.toContain("com.bishop.commandcenter.tunnel");

    rmSync(home, { recursive: true, force: true });
  });

  it("writes the tunnel job only when ~/.cloudflared/config.yml exists", () => {
    const home = path.join(mkdtempSync(path.join(tmpdir(), "cc-home-")), "with space");
    mkdirSync(path.join(home, ".cloudflared"), { recursive: true });
    writeFileSync(
      path.join(home, ".cloudflared", "config.yml"),
      "tunnel: command-center\ncredentials-file: /x/y.json\n",
    );
    const out = dryRun(home);
    expect(out).toContain("com.bishop.commandcenter.tunnel");
    expect(out).toContain("cloudflared"); // the tunnel-run program
    expect(out).toContain("command-center"); // the tunnel name parsed from config.yml
    rmSync(home, { recursive: true, force: true });
  });
});
