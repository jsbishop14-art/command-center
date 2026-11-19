// The link a "Connect" / "Reconnect" button points at for a Google target (a calendar "cal:<slug>",
// "gmail" or "intake"). A plain GET to the start route, so the browser follows the OAuth redirect
// chain cleanly (handoff §7.3, CC11 spec §1). Kept in its own module (not the "use server"
// feed-actions) so it can be a plain function imported by client and server components alike.
export function googleConnectHref(target: string): string {
  return `/api/auth/google/start?target=${encodeURIComponent(target)}`;
}
