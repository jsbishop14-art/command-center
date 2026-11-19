import { getDb } from "./db";
import { runMigrations } from "./migrations";
import { createUser, getUserByUsername } from "./users";
import { seedDeals } from "./deals/seed";

// Seed the two logins (handoff 1.1: Josh and Christine, separate logins; Christine sees
// everything). Passwords come from the environment so no real password is ever committed. In CI
// and local dev they default to known dev values; the install step (docs/install-mac.md) sets the
// real ones on the Mac mini. Idempotent: existing users are left untouched.
export function seed(): { created: string[] } {
  // Ensure schema exists first (lets `npm run seed` work on a fresh database).
  runMigrations(getDb());

  const created: string[] = [];
  const people = [
    {
      username: "josh",
      display_name: "Josh",
      role: "josh" as const,
      password: process.env.CC_JOSH_PASSWORD || "josh-dev-password",
    },
    {
      username: "christine",
      display_name: "Christine",
      role: "christine" as const,
      password: process.env.CC_CHRISTINE_PASSWORD || "christine-dev-password",
    },
  ];
  for (const p of people) {
    if (!getUserByUsername(p.username)) {
      createUser(p);
      created.push(p.username);
    }
  }
  // The five seed deals and their contacts (handoff §3.3, spec check 4). Idempotent: skipped if any
  // deal already exists.
  seedDeals();
  return { created };
}
