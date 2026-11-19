"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FeedStatusItem, FeedHealth } from "@/lib/feeds/status";

// Left menu from the mockup (docs/mockup/Main.dc.html). Home, Kanban and Settings are built; the
// other screens arrive in later builds and show "Coming in a later build" via /soon. Christine
// sees the same menu — she sees everything (handoff 1.1). The live feed list shows each feed's
// state (handoff §2); CC3 drives Calendars and Weather, the rest name their build.
type Item = { label: string; href?: string; soon?: string; count?: number };

const ITEMS: Item[] = [
  { label: "Home", href: "/home" },
  { label: "Projects", href: "/home#projects" },
  { label: "Kanban", href: "/kanban" },
  { label: "Inbox", href: "/inbox" },
  { label: "Calendar", soon: "CC3" },
  { label: "Schedule", href: "/schedule" },
  { label: "Deals", href: "/deals" },
  { label: "Contacts", href: "/contacts" },
  { label: "Builds", href: "/builds" },
  { label: "Money", href: "/money" },
  { label: "Phone lookup", href: "/phone" },
  { label: "Touch screen", href: "/touch" },
  { label: "Problems", href: "/kanban/problems" },
];

// Client-safe copy of the dot colours (the server status module imports the database).
const DOT: Record<FeedHealth, string> = {
  ok: "#15803D",
  pending: "#9A9EA7",
  error: "#DC2626",
};

export default function Nav({
  feeds,
  inboxCount,
  buildsBadge = 0,
}: {
  feeds: FeedStatusItem[];
  inboxCount: number;
  buildsBadge?: number;
}) {
  const pathname = usePathname();
  const items = ITEMS.map((it) =>
    it.label === "Inbox"
      ? { ...it, count: inboxCount }
      : it.label === "Builds"
        ? { ...it, count: buildsBadge }
        : it,
  );
  return (
    <nav className="nav" aria-label="Main">
      {items.map((it) =>
        it.href ? (
          <Link
            key={it.label}
            href={it.href}
            className={pathname === it.href ? "active" : undefined}
          >
            <span>{it.label}</span>
            {it.count ? (
              <span
                className={`nav-count${it.label === "Builds" ? " danger" : ""}`}
                data-testid={`nav-count-${it.label.toLowerCase()}`}
              >
                {it.count}
              </span>
            ) : null}
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
