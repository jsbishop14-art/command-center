// Live vs stub feeds. The default everywhere — CI, build sessions and local dev — is stub, so no
// build session or CI job ever makes a real outside call (handoff §7.5, CLAUDE §3). Only the Mac
// mini, with real connections, sets CC_LIVE_FEEDS=1 to pull real calendars and weather.
export function liveFeeds(): boolean {
  return process.env.CC_LIVE_FEEDS === "1";
}
