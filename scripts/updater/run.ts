#!/usr/bin/env tsx
// Entry point for the Mac mini updater (handoff 7.4). One pass by default; `--loop` checks every 5
// minutes (and the Mac mini triggers a pass on Refresh). Ordinary code, no AI.
import { runUpdate } from "./core";
import { realOps } from "./ops";

const FIVE_MINUTES = 5 * 60 * 1000;

function onePass(): void {
  const outcome = runUpdate(realOps());
  console.log(`updater: ${JSON.stringify(outcome)}`);
}

if (process.argv.includes("--loop")) {
  const tick = () => {
    try {
      onePass();
    } catch (e) {
      console.error("updater: pass failed:", e instanceof Error ? e.message : e);
    }
  };
  tick();
  setInterval(tick, FIVE_MINUTES);
} else {
  onePass();
}
