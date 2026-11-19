import Link from "next/link";
import { signOutAction } from "@/app/actions";
import BoardToggle from "./BoardToggle";
import RefreshButton from "./RefreshButton";
import QuickAdd from "./kanban/QuickAdd";
import type { Board } from "@/lib/prefs";
import type { WeatherReading } from "@/lib/feeds/store";

function today(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function TopBar({
  userName,
  board,
  weather,
  zip,
  refreshAgo,
}: {
  userName: string;
  board: Board;
  weather: WeatherReading | null;
  zip: string;
  refreshAgo: string;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="dot" />
        <div className="name">Command Center</div>
        <div className="date">{today()}</div>
      </div>

      {/* Weather from the saved zip (handoff §2). Pulled by Refresh, no AI. */}
      <div className="chip muted" aria-label="Weather" data-testid="weather">
        <span className="mono" data-testid="weather-temp">
          {weather ? `${weather.tempF}°` : "—°"}
        </span>
        <span>
          {weather
            ? `${weather.conditions} · rain ${weather.rainPct}% · H ${weather.hiF}° L ${weather.loF}° · ${zip}`
            : `refresh to load · ${zip}`}
        </span>
      </div>

      {/* Search routes to the kanban search for now; full cross-screen search arrives in CC5. */}
      <form action="/kanban" method="get" className="topbar-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B8BCC6" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input type="search" name="q" placeholder="Search projects, notes, contacts" aria-label="Search" />
      </form>

      <div style={{ flex: 1 }} />

      <RefreshButton ago={refreshAgo} />

      {/* Sync runs only when pressed and arrives in CC7 (handoff §5.1). Placeholder until then. */}
      <button className="chip" type="button" disabled data-testid="sync-placeholder" title="Sync with Claude runs in CC7">
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.15 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Sync with Claude</span>
          <span className="mono" style={{ fontSize: 10, color: "#b8bcc6" }}>
            runs in CC7
          </span>
        </span>
      </button>

      {/* The bell opens Builds, which arrives in CC8. Placeholder, no count until then. */}
      <Link href="/soon?s=Builds" className="chip" aria-label="Builds" data-testid="bell" style={{ width: 40, justifyContent: "center" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F4F4F1" strokeWidth="2" aria-hidden="true">
          <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      </Link>

      <QuickAdd />

      <BoardToggle board={board} />

      <div className="user">
        <span style={{ fontSize: 13, color: "#d4d7de" }}>{userName}</span>
        <form action={signOutAction}>
          <button className="chip" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
