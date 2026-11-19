import { connectedFeeds, getFeedStateRow } from "./store";
import { gmailConnected } from "./gmail";
import { duetEnabled } from "../kanban/state";

// The left-menu live feed list (handoff §2, mockup Main). CC3 drives Calendars and Weather from
// real feed health; the rest are placeholders naming the build that connects them. No AI.

export type FeedHealth = "ok" | "pending" | "error";
export type FeedStatusItem = { name: string; state: string; health: FeedHealth };

export function getFeedStatuses(): FeedStatusItem[] {
  const cal = getFeedStateRow("calendars");
  const wx = getFeedStateRow("weather");
  const gmail = getFeedStateRow("gmail");
  const connected = connectedFeeds().length;
  const duet = duetEnabled();

  // Gmail (CC4): Awaiting reply and the note intake. Shows its last Refresh state once connected;
  // until Josh connects Gmail in Settings it reads "not connected".
  const gmailState = gmail ? gmail.detail : gmailConnected() ? "refresh to load" : "not connected";
  const gmailHealth: FeedHealth = gmail ? (gmail.status === "ok" ? "ok" : "error") : gmailConnected() ? "ok" : "pending";

  const calState = cal ? cal.detail : connected ? `${connected} connected` : "not connected";
  const calHealth: FeedHealth = cal ? (cal.status === "ok" ? "ok" : "error") : connected ? "ok" : "pending";
  const wxState = wx ? wx.detail : "refresh to load";
  const wxHealth: FeedHealth = wx ? (wx.status === "ok" ? "ok" : "error") : "pending";

  return [
    { name: "Gmail", state: gmailState, health: gmailHealth },
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
