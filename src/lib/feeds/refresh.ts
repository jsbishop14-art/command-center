import { nowEastern, todayEastern } from "../kanban/time";
import { fetchWeather } from "./weather";
import { fetchCalendarEvents } from "./calendars";
import { gmailConnected } from "./gmail";
import { pollIntake } from "./intake";
import { awaitingReply } from "./awaiting";
import {
  connectedFeeds,
  replaceEvents,
  getZip,
  saveWeather,
  setFeedState,
  setLastRefreshAt,
  feedToken,
} from "./store";

// Refresh (handoff §5.2): pull calendars and weather on demand. Ordinary code, NO AI — this module
// calls no Claude/Anthropic client and imports none (spec check 4). Each feed records its own
// health so one failing feed does not stop the others.

export type RefreshResult = {
  at: string;
  weather: { ok: boolean; detail: string };
  calendars: { ok: boolean; detail: string; count: number };
  gmail: { ok: boolean; detail: string; notes: number; awaiting: number };
};

function message(e: unknown): string {
  return e instanceof Error ? e.message : "failed";
}

export async function runRefresh(): Promise<RefreshResult> {
  const at = nowEastern();
  const date = todayEastern();

  let weather: RefreshResult["weather"];
  try {
    const zip = getZip();
    const w = await fetchWeather(zip, at);
    saveWeather(w);
    setFeedState("weather", "ok", `${w.tempF}° · ${zip}`, at);
    weather = { ok: true, detail: `${w.tempF}°` };
  } catch (e) {
    const detail = message(e);
    setFeedState("weather", "error", detail, at);
    weather = { ok: false, detail };
  }

  const feeds = connectedFeeds();
  let count = 0;
  let calendars: RefreshResult["calendars"];
  try {
    for (const f of feeds) {
      const events = await fetchCalendarEvents(f.slug, date, feedToken(f.slug));
      replaceEvents(f.slug, events, at);
      count += events.length;
    }
    const detail = feeds.length ? `${feeds.length} connected` : "none connected";
    setFeedState("calendars", "ok", detail, at);
    calendars = { ok: true, detail, count };
  } catch (e) {
    const detail = message(e);
    setFeedState("calendars", "error", detail, at);
    calendars = { ok: false, detail, count };
  }

  // Gmail: pull notes from the intake mailbox and count flagged Awaiting-reply threads. Ordinary
  // code, no AI. Nothing happens until Josh connects Gmail (handoff §7.3; done on the Mac mini).
  let gmail: RefreshResult["gmail"];
  try {
    if (!gmailConnected()) {
      setFeedState("gmail", "ok", "not connected", at);
      gmail = { ok: true, detail: "not connected", notes: 0, awaiting: 0 };
    } else {
      const intake = pollIntake(at);
      const awaiting = awaitingReply(new Date(at)).length;
      const detail = `${awaiting} awaiting`;
      setFeedState("gmail", "ok", detail, at);
      gmail = { ok: true, detail, notes: intake.created.length, awaiting };
    }
  } catch (e) {
    const detail = message(e);
    setFeedState("gmail", "error", detail, at);
    gmail = { ok: false, detail, notes: 0, awaiting: 0 };
  }

  setLastRefreshAt(at);
  return { at, weather, calendars, gmail };
}
