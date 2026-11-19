// Live vs stub for phone lookup (handoff §8.3, spec §6; CLAUDE §3). The default everywhere — CI,
// build sessions, local dev — is the stub, so no build session or CI job makes a real Twilio, FTC
// or FCC call. Only the Mac mini sets CC_LIVE_PHONE=1 to use the real sources, with the three keys
// set in Settings. The live path is never exercised by tests. Mirrors feeds/mode.ts,
// sync/mode.ts and builds/mode.ts exactly. No AI.
export function livePhone(): boolean {
  return process.env.CC_LIVE_PHONE === "1";
}
