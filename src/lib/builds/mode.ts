// Live vs stub GitHub. The default everywhere — CI, build sessions and local dev — is the stub, so
// no build session or CI job ever reads from or writes to real GitHub (spec §6 "No real GitHub
// writes from CI"; handoff §7.5; CLAUDE §3). Only the Mac mini sets CC_LIVE_GITHUB=1 to use the real
// GitHub API with the token in the secret store (github_token). The live path is never exercised by
// tests. This mirrors feeds/mode.ts (CC_LIVE_FEEDS) and sync/mode.ts (CC_LIVE_AI) exactly.
export function liveGitHub(): boolean {
  return process.env.CC_LIVE_GITHUB === "1";
}
