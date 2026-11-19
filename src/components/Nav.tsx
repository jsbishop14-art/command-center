"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Left menu from the mockup (docs/mockup/Main.dc.html). Home and Settings are built in CC1; the
// other screens arrive in later builds and their menu items show "Coming in a later build" via the
// /soon page (spec §1). Christine sees the same menu — she sees everything (handoff 1.1).
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

export default function Nav() {
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
      <div className="subtle" style={{ padding: "0 12px" }}>
        Feeds connect in later builds.
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
