import { describe, it, expect, beforeEach } from "vitest";
import { useTempDb, TEST_SECRET_KEY } from "./helpers";
import { getDb } from "../../src/lib/db";
import { runMigrations } from "../../src/lib/migrations";
import { weatherRequestUrl, fetchWeather, DEFAULT_ZIP } from "../../src/lib/feeds/weather";
import { fetchCalendarEvents } from "../../src/lib/feeds/calendars";
import {
  listFeeds,
  connectedFeeds,
  connectFeed,
  disconnectFeed,
  getZip,
  setZip,
  getWeather,
  eventsOnDate,
  getLastRefreshAt,
  getFeedStateRow,
} from "../../src/lib/feeds/store";
import { runRefresh } from "../../src/lib/feeds/refresh";
import { todayEastern } from "../../src/lib/kanban/time";

describe("feeds: weather request and stub (spec check 3)", () => {
  it("builds a request that carries the zip, so a zip change changes the request", () => {
    const a = weatherRequestUrl("33472");
    const b = weatherRequestUrl("10001");
    expect(a).toContain("33472");
    expect(b).toContain("10001");
    expect(a).not.toBe(b);
  });

  it("stub reading is deterministic and varies with the zip", async () => {
    const at = "2026-11-19T09:00:00-05:00";
    const a = await fetchWeather("33472", at);
    const b = await fetchWeather("10001", at);
    expect(a).toEqual(await fetchWeather("33472", at)); // deterministic
    expect(a.tempF).not.toBe(b.tempF); // varies by zip
    expect(a.requestUrl).toContain("33472");
  });
});

describe("feeds: calendar stub", () => {
  it("returns events for a feed on a date, with ids scoped to feed+date", async () => {
    const evs = await fetchCalendarEvents("josh_work", "2026-11-19", null);
    expect(evs.length).toBeGreaterThan(0);
    expect(evs[0].startsAt.slice(0, 10)).toBe("2026-11-19");
    expect(evs[0].id).toContain("josh_work");
  });
});

describe("feeds: store and refresh", () => {
  beforeEach(() => {
    process.env.CC_SECRET_KEY = TEST_SECRET_KEY;
    useTempDb();
    runMigrations(getDb());
  });

  it("seeds the three fixed calendars, none connected at first", () => {
    const feeds = listFeeds();
    expect(feeds.map((f) => f.slug)).toEqual(["josh_work", "josh_personal", "christine"]);
    expect(connectedFeeds()).toHaveLength(0);
    expect(getZip()).toBe(DEFAULT_ZIP);
  });

  it("connect stores a token and marks connected; disconnect clears both and its events", async () => {
    const at = "2026-11-19T09:00:00-05:00";
    connectFeed("josh_work", at, "josh");
    expect(connectedFeeds().map((f) => f.slug)).toEqual(["josh_work"]);
    // A stored secret for the feed exists.
    const row = getDb().prepare("SELECT name FROM secrets WHERE name = 'gcal_josh_work'").get();
    expect(row).toBeTruthy();

    await runRefresh();
    const today = todayEastern();
    expect(eventsOnDate(today).length).toBeGreaterThan(0);

    disconnectFeed("josh_work");
    expect(connectedFeeds()).toHaveLength(0);
    expect(getDb().prepare("SELECT name FROM secrets WHERE name = 'gcal_josh_work'").get()).toBeUndefined();
    expect(eventsOnDate(today)).toHaveLength(0);
  });

  it("refresh pulls weather and events from all three connected feeds, in their colours", async () => {
    const at = "2026-11-19T09:00:00-05:00";
    for (const slug of ["josh_work", "josh_personal", "christine"]) connectFeed(slug, at, "josh");

    const result = await runRefresh();
    expect(result.weather.ok).toBe(true);
    expect(result.calendars.ok).toBe(true);
    expect(result.calendars.count).toBeGreaterThanOrEqual(3);

    // Weather cached for the saved zip.
    const w = getWeather(getZip());
    expect(w?.zip).toBe(DEFAULT_ZIP);

    // Today's events include all three person colours (check 2 at the data layer).
    const colours = new Set(eventsOnDate(todayEastern()).map((e) => e.color));
    expect(colours.has("#16181D")).toBe(true); // Josh work
    expect(colours.has("#8A8F99")).toBe(true); // Josh personal
    expect(colours.has("#2F5BD3")).toBe(true); // Christine

    // Feed health and last-refresh recorded.
    expect(getFeedStateRow("weather")?.status).toBe("ok");
    expect(getFeedStateRow("calendars")?.status).toBe("ok");
    expect(getLastRefreshAt()).toBeTruthy();
  });

  it("changing the saved zip changes the request the weather feed makes (check 3)", async () => {
    setZip("10001");
    await runRefresh();
    const w = getWeather("10001");
    expect(w).toBeTruthy();
    expect(w?.requestUrl).toContain("10001");
    expect(w?.requestUrl).not.toContain("33472");
  });
});
