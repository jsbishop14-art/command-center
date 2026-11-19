import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { touchView } from "@/lib/touch/view";
import { getTouchIdleMinutes } from "@/lib/touch/settings";
import TouchScreen from "@/components/touch/TouchScreen";

export const dynamic = "force-dynamic";

// The ambient touch screen (handoff §6, spec §1). A full-screen route outside the dashboard chrome
// (no top bar, no left menu) so Chromium kiosk shows only the two swipe screens. Signed-in like any
// screen; a kiosk session stays signed in on the Mac mini. Display only, apart from the toggle and
// swipe. The idle time is editable in Settings; a ?idle=<seconds> query overrides it for a preview
// (and the browser tests), and ?poll=<ms> sets the refresh cadence — neither writes anything.

function num(v: string | string[] | undefined): number | null {
  if (typeof v !== "string") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function TouchPage({
  searchParams,
}: {
  searchParams: { idle?: string; poll?: string };
}) {
  const user = currentUser();
  if (!user) redirect("/signin");

  const idleMinutes = getTouchIdleMinutes();
  const view = touchView(new Date(), idleMinutes);
  const idleOverride = num(searchParams.idle);
  const idleMs = idleOverride !== null ? idleOverride * 1000 : idleMinutes * 60_000;
  const pollMs = num(searchParams.poll) ?? 15_000;

  return <TouchScreen initialView={view} idleMs={idleMs} pollMs={pollMs} />;
}
