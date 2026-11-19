#!/usr/bin/env tsx
// Entry point for the Mac mini updater (handoff 7.4, CC12). One pass, then exit. The launchd job
// runs it once a day at 3:00 AM Eastern (StartCalendarInterval) — there is no 5-minute loop
// (Josh, 2026-11-19 16:11: "every 5 minutes seems excessive. it should be once a day and then on
// command."). The Settings "Check for updates now" button runs one pass on command. Every pass
// records its result so Settings can show when the last check ran and how it went.
//
// `--record-live` records the currently checked-out merge as the live version WITHOUT updating,
// used by the installer so the first pass after install does nothing when the code is already
// current (check 1). Ordinary code, no AI.
import { runUpdate } from "./core";
import { realOps, recordCheck, recordLiveFromHead } from "./ops";

if (process.argv.includes("--record-live")) {
  const sha = recordLiveFromHead();
  console.log(`updater: recorded live = ${sha ? sha.slice(0, 8) : "none (no [Merge] commit on HEAD)"}`);
} else {
  const outcome = runUpdate(realOps());
  recordCheck(outcome);
  console.log(`updater: ${JSON.stringify(outcome)}`);
}
