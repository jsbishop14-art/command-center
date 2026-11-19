import { getSetting, setSetting } from "@/lib/kanban/state";

// The touch screen's one editable setting (handoff §6, spec §1): the idle time after which the
// screen returns to screen 1. Stored in the existing app_settings table (no new migration — CC9 is
// display-only). Default 3 minutes (handoff §6: "returns to screen 1 after 3 minutes without a
// touch"). Clamped to a sane range so a bad value can never freeze the display or thrash it.

export const IDLE_SETTING = "touch_idle_minutes";
export const DEFAULT_IDLE_MINUTES = 3;
export const MIN_IDLE_MINUTES = 1;
export const MAX_IDLE_MINUTES = 60;

export function getTouchIdleMinutes(): number {
  const raw = getSetting(IDLE_SETTING);
  const n = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_IDLE_MINUTES;
  return clampIdle(Math.round(n));
}

// Returns the value actually stored (clamped), so the caller can show it back. Throws on a value
// that is not a number at all, so Settings can report the error instead of silently defaulting.
export function setTouchIdleMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) throw new Error("Idle minutes must be a number.");
  const clamped = clampIdle(Math.round(minutes));
  setSetting(IDLE_SETTING, String(clamped));
  return clamped;
}

export function clampIdle(n: number): number {
  return Math.max(MIN_IDLE_MINUTES, Math.min(MAX_IDLE_MINUTES, n));
}
