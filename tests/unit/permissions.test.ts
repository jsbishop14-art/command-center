import { describe, it, expect, beforeEach } from "vitest";
import { useTempDb } from "./helpers";
import { getDb } from "../../src/lib/db";
import { runMigrations } from "../../src/lib/migrations";
import { seed } from "../../src/lib/seed";
import { authenticate } from "../../src/lib/users";

// Permission tests state the answer for every role and token, deny and allow (CLAUDE §4, §7).
// CC1 has two login roles (Josh, Christine) and three tokens (Claude, Duet, Shortcut) whose routes
// arrive in later builds. This file covers credential allow/deny for the logins. Route-level denial
// (signed-out reaches nothing; token routes are absent in CC1) is covered by the browser tests
// (tests/e2e/permissions.e2e.ts).
//
// CC1 permission map:
//   Josh (login)      -> sign in with the right password: ALLOW; wrong password: DENY
//   Christine (login) -> sign in with the right password: ALLOW; wrong password: DENY
//   unknown user      -> DENY
//   Claude token      -> no route in CC1 (DENY: entry point absent) — asserted in e2e
//   Duet token        -> no route in CC1 (DENY: entry point absent) — asserted in e2e
//   Shortcut token    -> no route in CC1 (DENY: entry point absent) — asserted in e2e

describe("login credentials (allow and deny for every login role)", () => {
  beforeEach(() => {
    useTempDb();
    process.env.CC_JOSH_PASSWORD = "josh-pw";
    process.env.CC_CHRISTINE_PASSWORD = "christine-pw";
    runMigrations(getDb());
    seed();
  });

  it("Josh: right password allows, wrong password denies", () => {
    expect(authenticate("josh", "josh-pw")?.role).toBe("josh");
    expect(authenticate("josh", "nope")).toBeNull();
  });

  it("Christine: right password allows, wrong password denies; she sees everything (role christine)", () => {
    const c = authenticate("christine", "christine-pw");
    expect(c?.role).toBe("christine");
    expect(authenticate("christine", "nope")).toBeNull();
  });

  it("unknown user denies", () => {
    expect(authenticate("duet", "anything")).toBeNull();
    expect(authenticate("claude", "anything")).toBeNull();
  });
});
