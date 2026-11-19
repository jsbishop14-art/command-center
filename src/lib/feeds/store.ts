import { getDb } from "../db";
import { getSecret, setSecret, deleteSecret, calendarTokenName } from "../secrets";
import type { FeedEvent } from "./calendars";
import type { Weather } from "./weather";
import { DEFAULT_ZIP } from "./weather";

// Database side of the Home feeds (handoff §2, §7.3): the three calendars, their cached events,
// the saved weather and the per-feed health shown in the left menu. Single household, no AI.

export type CalendarFeed = {
  slug: string;
  label: string;
  owner: "josh" | "christine";
  color: string;
  sort: number;
  connectedAt: string | null;
};

type FeedRow = {
  slug: string;
  label: string;
  owner: "josh" | "christine";
  color: string;
  sort: number;
  connected_at: string | null;
};

function toFeed(r: FeedRow): CalendarFeed {
  return {
    slug: r.slug,
    label: r.label,
    owner: r.owner,
    color: r.color,
    sort: r.sort,
    connectedAt: r.connected_at,
  };
}

export function listFeeds(): CalendarFeed[] {
  return (
    getDb()
      .prepare("SELECT slug, label, owner, color, sort, connected_at FROM calendar_feeds ORDER BY sort")
      .all() as FeedRow[]
  ).map(toFeed);
}

export function getFeed(slug: string): CalendarFeed | null {
  const r = getDb()
    .prepare("SELECT slug, label, owner, color, sort, connected_at FROM calendar_feeds WHERE slug = ?")
    .get(slug) as FeedRow | undefined;
  return r ? toFeed(r) : null;
}

export function connectedFeeds(): CalendarFeed[] {
  return listFeeds().filter((f) => f.connectedAt);
}

// Connect a calendar: store its OAuth token in the secret store (spec §3) and mark it connected.
// The build uses a stub token; the real token arrives when Josh signs in on the Mac mini.
export function connectFeed(slug: string, at: string, by: string, token = "stub-token"): void {
  if (!getFeed(slug)) throw new Error(`unknown calendar ${slug}`);
  setSecret(calendarTokenName(slug), token, by);
  getDb().prepare("UPDATE calendar_feeds SET connected_at = ? WHERE slug = ?").run(at, slug);
}

export function disconnectFeed(slug: string): void {
  deleteSecret(calendarTokenName(slug));
  getDb().prepare("UPDATE calendar_feeds SET connected_at = NULL WHERE slug = ?").run(slug);
  getDb().prepare("DELETE FROM calendar_events WHERE feed = ?").run(slug);
}

// Mark a calendar connected without touching its token (the OAuth callback stores the token bundle
// separately, in the secret store, via the Google client). Used by the CC11 connect flow.
export function setFeedConnectedAt(slug: string, at: string): void {
  if (!getFeed(slug)) throw new Error(`unknown calendar ${slug}`);
  getDb().prepare("UPDATE calendar_feeds SET connected_at = ? WHERE slug = ?").run(at, slug);
}

export function feedToken(slug: string): string | null {
  return getSecret(calendarTokenName(slug));
}

// Replace the cached events for one feed (Refresh pulls fresh and swaps them in).
export function replaceEvents(feed: string, events: FeedEvent[], at: string): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM calendar_events WHERE feed = ?").run(feed);
    const ins = db.prepare(
      `INSERT INTO calendar_events (id, feed, title, starts_at, ends_at, all_day, location, fetched_at)
       VALUES (@id, @feed, @title, @starts_at, @ends_at, @all_day, @location, @fetched_at)`,
    );
    for (const e of events) {
      ins.run({
        id: e.id,
        feed,
        title: e.title,
        starts_at: e.startsAt,
        ends_at: e.endsAt,
        all_day: e.allDay ? 1 : 0,
        location: e.location,
        fetched_at: at,
      });
    }
  });
  tx();
}

export type DayEvent = {
  id: string;
  feed: string;
  label: string;
  owner: string;
  color: string;
  title: string;
  startsAt: string;
  allDay: boolean;
  location: string | null;
};

// Events on a given Eastern date (YYYY-MM-DD) across connected feeds, with their feed colour,
// ordered by start time. Only connected feeds contribute (an event whose feed was disconnected is
// already cleared). All-day events sort first.
export function eventsOnDate(dateYmd: string): DayEvent[] {
  return getDb()
    .prepare(
      `SELECT e.id, e.feed, f.label, f.owner, f.color, e.title, e.starts_at AS startsAt,
              e.all_day AS allDay, e.location
         FROM calendar_events e
         JOIN calendar_feeds f ON f.slug = e.feed
        WHERE f.connected_at IS NOT NULL AND substr(e.starts_at, 1, 10) = ?
        ORDER BY e.all_day DESC, e.starts_at`,
    )
    .all(dateYmd)
    .map((r) => {
      const row = r as Omit<DayEvent, "allDay"> & { allDay: number };
      return { ...row, allDay: !!row.allDay };
    });
}

// ---- Weather ----

export function getZip(): string {
  const r = getDb().prepare("SELECT value FROM app_settings WHERE key = 'weather_zip'").get() as
    | { value: string }
    | undefined;
  return r?.value || DEFAULT_ZIP;
}

export function setZip(zip: string): void {
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value) VALUES ('weather_zip', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(zip);
}

export function saveWeather(w: Weather): void {
  getDb()
    .prepare(
      `INSERT INTO weather_readings (zip, temp_f, conditions, rain_pct, hi_f, lo_f, request_url, fetched_at)
       VALUES (@zip, @temp_f, @conditions, @rain_pct, @hi_f, @lo_f, @request_url, @fetched_at)
       ON CONFLICT(zip) DO UPDATE SET
         temp_f = excluded.temp_f, conditions = excluded.conditions, rain_pct = excluded.rain_pct,
         hi_f = excluded.hi_f, lo_f = excluded.lo_f, request_url = excluded.request_url,
         fetched_at = excluded.fetched_at`,
    )
    .run({
      zip: w.zip,
      temp_f: w.tempF,
      conditions: w.conditions,
      rain_pct: w.rainPct,
      hi_f: w.hiF,
      lo_f: w.loF,
      request_url: w.requestUrl,
      fetched_at: w.fetchedAt,
    });
}

export type WeatherReading = {
  zip: string;
  tempF: number;
  conditions: string;
  rainPct: number;
  hiF: number;
  loF: number;
  requestUrl: string;
  fetchedAt: string;
};

export function getWeather(zip: string): WeatherReading | null {
  const r = getDb()
    .prepare(
      `SELECT zip, temp_f AS tempF, conditions, rain_pct AS rainPct, hi_f AS hiF, lo_f AS loF,
              request_url AS requestUrl, fetched_at AS fetchedAt
         FROM weather_readings WHERE zip = ?`,
    )
    .get(zip) as WeatherReading | undefined;
  return r ?? null;
}

// ---- Refresh bookkeeping ----

export function setFeedState(feed: string, status: "ok" | "error", detail: string, at: string): void {
  getDb()
    .prepare(
      `INSERT INTO feed_state (feed, status, detail, at) VALUES (?, ?, ?, ?)
       ON CONFLICT(feed) DO UPDATE SET status = excluded.status, detail = excluded.detail, at = excluded.at`,
    )
    .run(feed, status, detail, at);
}

export type FeedStateRow = { feed: string; status: string; detail: string; at: string };

export function getFeedStateRow(feed: string): FeedStateRow | null {
  const r = getDb().prepare("SELECT feed, status, detail, at FROM feed_state WHERE feed = ?").get(feed) as
    | FeedStateRow
    | undefined;
  return r ?? null;
}

export function getLastRefreshAt(): string | null {
  const r = getDb().prepare("SELECT value FROM app_settings WHERE key = 'last_refresh_at'").get() as
    | { value: string }
    | undefined;
  return r?.value ?? null;
}

export function setLastRefreshAt(at: string): void {
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value) VALUES ('last_refresh_at', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(at);
}
