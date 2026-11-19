import { liveFeeds } from "./mode";

// The three Google calendars shown on Home (handoff §2 Today, §7.3). Ordinary code, no AI. The
// stub returns a fixed day of events per feed, used in CI, build sessions and local dev. The live
// path needs Josh's Google sign-in (OAuth token in the secret store); until he connects a calendar
// on the Mac mini it returns nothing, which is what Home shows before sign-in (spec §1).

export type FeedEvent = {
  id: string;
  title: string;
  startsAt: string; // ISO-8601, Eastern offset
  endsAt: string | null;
  allDay: boolean;
  location: string | null;
};

// Fixed sample days, one list per feed. Times are shown as-is; the stub stands in until a real
// Google calendar is connected.
const STUB: Record<string, { title: string; start: string; end: string; location?: string }[]> = {
  josh_work: [
    { title: "Site visit — Riverwood", start: "08:30", end: "09:30", location: "Riverwood" },
    { title: "Client call — Best Western Naples", start: "13:00", end: "13:30" },
  ],
  josh_personal: [{ title: "Dentist", start: "16:30", end: "17:15" }],
  christine: [
    { title: "School pickup", start: "15:00", end: "15:30" },
    { title: "Yoga", start: "18:00", end: "19:00" },
  ],
};

function stubEvents(feed: string, dateYmd: string): FeedEvent[] {
  const rows = STUB[feed] ?? [];
  return rows.map((r, i) => ({
    id: `${feed}-${dateYmd}-${i}`,
    title: r.title,
    startsAt: `${dateYmd}T${r.start}:00-05:00`,
    endsAt: `${dateYmd}T${r.end}:00-05:00`,
    allDay: false,
    location: r.location ?? null,
  }));
}

// Pull events for one connected feed, for the given Eastern date. `token` is the feed's OAuth
// token from the secret store; the stub ignores it. The live path is only reachable on the Mac
// mini (CC_LIVE_FEEDS=1) and needs a real Google client, wired when Josh connects his account.
export async function fetchCalendarEvents(
  feed: string,
  dateYmd: string,
  _token: string | null,
): Promise<FeedEvent[]> {
  if (!liveFeeds()) return stubEvents(feed, dateYmd);
  // Live Google Calendar access is wired with Josh's sign-in after this build lands (spec §1).
  // Until then the live path returns nothing rather than make an unauthenticated call.
  return [];
}
