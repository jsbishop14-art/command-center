"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FeedStatusItem, FeedHealth } from "@/lib/feeds/status";

// Left menu from the mockup (docs/mockup/Main.dc.html). Home, Kanban and Settings are built; the
// other screens arrive in later builds and show "Coming in a later build" via /soon. Christine
// sees the same menu — she sees everything (handoff 1.1). The live feed list shows each feed's
// state (handoff §2); CC3 drives Calendars and Weather, the rest name their build.
type Item = { label: string; href?: string; soon?: string };

const ITEMS: Item[] = [
  { label: "Home", href: "/home" },
  { label: "Projects", soon: "CC5" },
  { label: "Kanban", href: "/kanban" },
  { label: "Inbox", soon: "CC4" },
  { label: "Calendar", soon: "CC3" },
  { label: "Schedule", soon: "CC6" },
  { label: "Deals", soon: "CC5" },
  { label: "Contacts", soon: "CC5" },
  { label: "Builds", soon: "CC8" },
  { label: "Money", soon: "CC6" },
  { label: "Phone lookup", soon: "CC10" },
  { label: "Problems", href: "/kanban/problems" },
];

// Client-safe copy of the dot colours (the server status module imports the database).
const DOT: Record<FeedHealth, string> = {
  ok: "#15803D",
  pending: "#9A9EA7",
  error: "#DC2626",
};

export default function Nav({ feeds }: { feeds: FeedStatusItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {ITEMS.map((it) =>
        it.href ? (
          <Link
            key={it.label}
            href={it.href}
            className={pathname === it.href ? "active" : undefined}
          >
            <span>{it.label}</span>
          </Link>
        ) : (
          <Link
            key={it.label}
            href={`/soon?s=${encodeURIComponent(it.label)}`}
            className="soon"
          >
            <span>{it.label}</span>
            <span className="tag">later</span>
          </Link>
        ),
      )}

      <div className="sep" />
      <div className="section-label">Live feeds</div>
      <div className="feed-status" aria-label="Live feeds">
        {feeds.map((f) => (
          <div key={f.name} className="feed-status-row" data-testid={`feed-row-${f.name}`}>
            <span className="feed-dot" style={{ background: DOT[f.health] }} aria-hidden="true" />
            <span className="feed-name">{f.name}</span>
            <span className="feed-state mono">{f.state}</span>
          </div>
        ))}
      </div>

      <Link
        href="/settings"
        className={`settings${pathname === "/settings" ? " active" : ""}`}
      >
        <span>Settings</span>
      </Link>
    </nav>
  );
}
