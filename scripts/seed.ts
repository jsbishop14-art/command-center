#!/usr/bin/env tsx
// Seed the two logins. Passwords come from the environment (never committed).
import { dbPath } from "../src/lib/db";
import { seed } from "../src/lib/seed";

const result = seed();
console.log(`seed: database ${dbPath()}`);
console.log(`seed: created ${result.created.length ? result.created.join(", ") : "nothing (already seeded)"}`);
