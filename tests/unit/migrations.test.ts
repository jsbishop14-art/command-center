import { describe, it, expect, beforeEach } from "vitest";
import { useTempDb } from "./helpers";
import { getDb } from "../../src/lib/db";
import { runMigrations, expectedObjects } from "../../src/lib/migrations";
import { verifyObjects } from "../../src/lib/schema-check";

describe("migrations", () => {
  beforeEach(() => {
    useTempDb();
  });

  it("applies the foundation migration and every expected object reads back", () => {
    const db = getDb();
    const applied = runMigrations(db);
    expect(applied).toContain("0001_foundation");

    const check = verifyObjects(db);
    expect(check.ok).toBe(true);
    expect(check.missing).toHaveLength(0);
    expect(check.present.length).toBe(expectedObjects().length);
  });

  it("is idempotent: a second run applies nothing", () => {
    const db = getDb();
    runMigrations(db);
    const second = runMigrations(db);
    expect(second).toHaveLength(0);
  });

  it("read-back reports a missing object when one is absent", () => {
    const db = getDb();
    runMigrations(db);
    const check = verifyObjects(db, [{ type: "table", name: "does_not_exist" }]);
    expect(check.ok).toBe(false);
    expect(check.missing[0].name).toBe("does_not_exist");
  });
});
