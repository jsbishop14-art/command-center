import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useTempDb, TEST_SECRET_KEY } from "./helpers";
import { getDb } from "../../src/lib/db";
import { runMigrations } from "../../src/lib/migrations";
import { setSecret, getSecret, listSecretStatus } from "../../src/lib/secrets";
import { scrub, __resetRedactionsForTest } from "../../src/lib/log";

// Spec check 4 / CLAUDE §6: a secret written through the store appears in no log line.
const PLAINTEXT = "SK-SUPER-SECRET-TOKEN-9f3a2b7c";

describe("secrets never appear in logs", () => {
  let logged: string[];
  let restore: () => void;

  beforeEach(() => {
    useTempDb();
    process.env.CC_SECRET_KEY = TEST_SECRET_KEY;
    __resetRedactionsForTest();
    runMigrations(getDb());

    logged = [];
    const capture = (...args: unknown[]) => {
      logged.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    };
    const logSpy = vi.spyOn(console, "log").mockImplementation(capture);
    const errSpy = vi.spyOn(console, "error").mockImplementation(capture);
    restore = () => {
      logSpy.mockRestore();
      errSpy.mockRestore();
    };
  });

  afterEach(() => {
    restore();
  });

  it("does not leak the plaintext when writing, reading or listing", () => {
    setSecret("twilio_token", PLAINTEXT, "josh");
    expect(getSecret("twilio_token")).toBe(PLAINTEXT);
    const statuses = listSecretStatus();

    // No captured log line contains the plaintext.
    for (const line of logged) {
      expect(line).not.toContain(PLAINTEXT);
    }

    // The stored row is ciphertext, not the plaintext.
    const row = getDb()
      .prepare("SELECT ciphertext FROM secrets WHERE name = ?")
      .get("twilio_token") as { ciphertext: string };
    expect(row.ciphertext).not.toContain(PLAINTEXT);

    // The status shown back is masked, never the full value.
    const twilio = statuses.find((s) => s.name === "twilio_token")!;
    expect(twilio.isSet).toBe(true);
    expect(twilio.hint).toBe("••••2b7c");
    expect(twilio.hint).not.toContain(PLAINTEXT);
  });

  it("scrubs a registered secret if something ever tries to log it", () => {
    setSecret("github_token", PLAINTEXT, "josh");
    // setSecret registers the value as sensitive; any later log is scrubbed.
    expect(scrub(`token is ${PLAINTEXT} here`)).toBe("token is [REDACTED] here");
  });
});
