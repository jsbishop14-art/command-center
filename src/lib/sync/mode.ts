// Live vs stub Claude. The default everywhere — CI, build sessions and local dev — is the stub, so
// no build session or CI job ever calls Claude (spec §6 grant "In CI, Claude is stubbed"; CLAUDE
// §3). Only the Mac mini sets CC_LIVE_AI=1 to run Claude through the Claude Code command line, signed
// in to Josh's plan with no API key (spec §2, §5.6) — the same way the build runner does. The live
// path is never exercised by tests. This mirrors feeds/mode.ts (CC_LIVE_FEEDS) exactly.
export function liveAI(): boolean {
  return process.env.CC_LIVE_AI === "1";
}
