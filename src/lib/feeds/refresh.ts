import { nowEastern, todayEastern } from "../kanban/time";
import { fetchWeather } from "./weather";
import { fetchCalendarEvents } from "./calendars";
import { gmailConnected } from "./gmail";
import { prefetchGmailLive } from "./google";
import { pollIntake } from "./intake";
import { awaitingReply } from "./awaiting";
import { ezbSync } from "../ezbinder/sync";
import { ezbShouldSync } from "../ezbinder/client";
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
  ezbinder: { ok: boolean; detail: string };
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
      // On the live path pull Gmail (threads, intake) into the client caches before reading them;
      // a no-op in CI / build sessions where the Google transport is the stub.
      await prefetchGmailLive(new Date(at));
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

  // EZ Binder (handoff §7.3): the on-demand pull of money, jobs and the schedule, with the slip
  // rule run over the result. Ordinary code, no AI. Skipped on an unconnected Mac mini so no stub
  // data appears there; always runs in CI, build sessions and dev (ezbShouldSync).
  let ezbinder: RefreshResult["ezbinder"];
  try {
    if (!ezbShouldSync()) {
      setFeedState("ezbinder", "ok", "not connected", at);
      ezbinder = { ok: true, detail: "not connected" };
    } else {
      const r = await ezbSync({ at });
      const detail = `${r.jobs} jobs · ${r.tasks} tasks${r.proposals ? ` · ${r.proposals} proposed` : ""}`;
      setFeedState("ezbinder", "ok", detail, at);
      ezbinder = { ok: true, detail };
    }
  } catch (e) {
    const detail = message(e);
    setFeedState("ezbinder", "error", detail, at);
    ezbinder = { ok: false, detail };
  }

  setLastRefreshAt(at);
  return { at, weather, calendars, gmail, ezbinder };
}
