import { connectedFeeds, getFeedStateRow } from "./store";
import { duetEnabled } from "../kanban/state";

// The left-menu live feed list (handoff §2, mockup Main). CC3 drives Calendars and Weather from
// real feed health; the rest are placeholders naming the build that connects them. No AI.

export type FeedHealth = "ok" | "pending" | "error";
export type FeedStatusItem = { name: string; state: string; health: FeedHealth };

export function getFeedStatuses(): FeedStatusItem[] {
  const cal = getFeedStateRow("calendars");
  const wx = getFeedStateRow("weather");
  const connected = connectedFeeds().length;
  const duet = duetEnabled();

  const calState = cal ? cal.detail : connected ? `${connected} connected` : "not connected";
  const calHealth: FeedHealth = cal ? (cal.status === "ok" ? "ok" : "error") : connected ? "ok" : "pending";
  const wxState = wx ? wx.detail : "refresh to load";
  const wxHealth: FeedHealth = wx ? (wx.status === "ok" ? "ok" : "error") : "pending";

  return [
    { name: "Gmail", state: "CC4", health: "pending" },
    { name: "Calendars (3)", state: calState, health: calHealth },
    { name: "EZ Binder", state: "CC6", health: "pending" },
    { name: "Claude", state: "on Sync", health: "pending" },
    { name: "Duet", state: duet ? "on" : "off", health: duet ? "ok" : "pending" },
    { name: "Build files", state: "CC8", health: "pending" },
    { name: "Weather", state: wxState, health: wxHealth },
  ];
}

export const FEED_DOT: Record<FeedHealth, string> = {
  ok: "#15803D",
  pending: "#9A9EA7",
  error: "#DC2626",
};
