import { describe, it, expect, beforeEach } from "vitest";
import { useTempDb } from "./helpers";
import { openDatabaseAt } from "../../src/lib/db";
import { runMigrations } from "../../src/lib/migrations";
import { createUser } from "../../src/lib/users";
import {
  createSession,
  resolveSession,
  deleteSession,
  mintSmokeSession,
  SESSION_WINDOW_DAYS,
} from "../../src/lib/sessions";
import { readFileSync } from "node:fs";

// CC12 spec §1 "Stay signed in", check 7: sessions slide forward on use so Josh and Christine stay
// signed in; a restart does not invalidate a session; sign out still works. The window is long
// (one year) so in normal use they never sign in again.

const DAY = 24 * 60 * 60 * 1000;

function freshDb() {
  useTempDb();
  // getDb() is process-global and would reuse a stale connection; open an explicit one on the file
  // and migrate it, then return it.
  const file = process.env.CC_DB_PATH as string;
  const db = openDatabaseAt(file);
  runMigrations(db);
  return db;
}

describe("sliding sessions", () => {
  let db: ReturnType<typeof openDatabaseAt>;
  let userId: number;

  beforeEach(() => {
    db = freshDb();
    // createUser uses getDb(); it reads the same CC_DB_PATH, so it writes to this file. Open a
    // second handle only for assertions; writes land in the same SQLite file.
    userId = createUser({
      username: "josh",
      display_name: "Josh",
      role: "josh",
      password: "not-the-dev-password",
    });
  });

  it("uses a one-year window (logged choice)", () => {
    expect(SESSION_WINDOW_DAYS).toBe(365);
  });

  it("extends a session on use (sliding expiry), so it never lapses while in use", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const { token } = createSession(db, userId, start);

    const firstExpiry = (
      db.prepare("SELECT expires_at FROM sessions").get() as { expires_at: string }
    ).expires_at;

    // Use it 300 days later — still inside the 365-day window.
    const later = new Date(start.getTime() + 300 * DAY);
    const resolved = resolveSession(db, token, later);
    expect(resolved?.userId).toBe(userId);

    const secondExpiry = (
      db.prepare("SELECT expires_at FROM sessions").get() as { expires_at: string }
    ).expires_at;
    // The expiry moved forward to later + 365 days, i.e. the session now lasts well past the
    // original expiry: it was extended, not left to lapse.
    expect(new Date(secondExpiry).getTime()).toBeGreaterThan(new Date(firstExpiry).getTime());
    expect(new Date(secondExpiry).getTime()).toBe(later.getTime() + SESSION_WINDOW_DAYS * DAY);
  });

  it("treats a session unused past the window as signed out and prunes it", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const { token } = createSession(db, userId, start);
    // Not used for 366 days (past the window).
    const tooLate = new Date(start.getTime() + (SESSION_WINDOW_DAYS + 1) * DAY);
    expect(resolveSession(db, token, tooLate)).toBeNull();
    expect((db.prepare("SELECT COUNT(*) c FROM sessions").get() as { c: number }).c).toBe(0);
  });

  it("a restart does not invalidate a session — the row survives and still resolves", () => {
    const start = new Date("2026-06-01T00:00:00.000Z");
    const { token } = createSession(db, userId, start);
    db.close();
    // Reopen the SAME file (what a restart does): the session is still there and still resolves.
    const reopened = openDatabaseAt(process.env.CC_DB_PATH as string);
    const resolved = resolveSession(reopened, token, new Date(start.getTime() + DAY));
    expect(resolved?.userId).toBe(userId);
    reopened.close();
  });

  it("sign out deletes the session", () => {
    const { token } = createSession(db, userId, new Date("2026-01-01T00:00:00.000Z"));
    deleteSession(db, token);
    expect(resolveSession(db, token)).toBeNull();
  });
});

// CC12 check 5: the smoke check proves both logins reach Home against a database whose passwords are
// NOT the dev defaults, with no password supplied. A minted smoke session resolves to the user; no
// password is read or needed.
describe("smoke session (reach Home without a password)", () => {
  it("mints a session that resolves to the user when the password is not a dev default", () => {
    const sdb = freshDb();
    const uid = createUser({
      username: "christine",
      display_name: "Christine",
      role: "christine",
      password: "a-password-the-updater-does-not-know-12345",
    });
    const { token } = mintSmokeSession(sdb, uid);
    const resolved = resolveSession(sdb, token);
    expect(resolved?.userId).toBe(uid);
  });

  it("the smoke script reads no password from the environment", () => {
    const src = readFileSync("scripts/smoke.ts", "utf8");
    // It may mention the old password vars in the comment explaining the fix, but it must not read
    // any *_PASSWORD from the environment.
    expect(src).not.toMatch(/process\.env\.[A-Za-z_]*PASSWORD/);
  });
});
