import { liveFeeds } from "./mode";
import { SAMPLE_CALENDAR } from "./samples";
import { listCalendarEvents } from "./google";

// The three Google calendars shown on Home (handoff §2 Today, §7.3). Ordinary code, no AI.
//
// Two paths, both deterministic in CI / build sessions / local dev:
//  - Legacy stub path (CC_LIVE_FEEDS off, the default here): return the sample day directly. This
//    is what CC3 shipped and what every build session and CI job uses (spec §2).
//  - Live code path (CC_LIVE_FEEDS on): pull through the Google client (src/lib/feeds/google.ts).
//    On the Mac mini with a real Google client that calls Google; in CI / build sessions the Google
//    transport is the stub, so it returns the same sample day (spec §3, check 3) without any real
//    call. A calendar that is not connected (no OAuth token stored) returns nothing.

export type FeedEvent = {
  id: string;
  title: string;
  startsAt: string; // ISO-8601, Eastern offset
  endsAt: string | null;
  allDay: boolean;
  location: string | null;
};

// Build the sample day for one feed on the given Eastern date. Shared by the legacy stub path and
// the stub Google transport so both show identical events.
export function sampleEvents(feed: string, dateYmd: string): FeedEvent[] {
  const rows = SAMPLE_CALENDAR[feed] ?? [];
  return rows.map((r, i) => ({
    id: `${feed}-${dateYmd}-${i}`,
    title: r.title,
    startsAt: `${dateYmd}T${r.start}:00-05:00`,
    endsAt: `${dateYmd}T${r.end}:00-05:00`,
    allDay: false,
    location: r.location ?? null,
  }));
}

// Pull events for one connected feed, for the given Eastern date. `_token` is kept for the legacy
// signature; the live path reads and refreshes its own OAuth token inside the Google client.
export async function fetchCalendarEvents(
  feed: string,
  dateYmd: string,
  _token: string | null,
): Promise<FeedEvent[]> {
  if (!liveFeeds()) return sampleEvents(feed, dateYmd);
  // Live code path: through the Google client (real Google on the Mac mini, stub Google here).
  return listCalendarEvents(feed, dateYmd);
}
