import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getBoard, getHomeLayout, type Board } from "@/lib/prefs";
import { todayEastern } from "@/lib/kanban/time";
import { eventsOnDate, connectedFeeds, type DayEvent } from "@/lib/feeds/store";
import { inProgressCards, cardsDueOn } from "@/lib/kanban/view";
import type { Card } from "@/lib/kanban/types";
import HomePanels, { type PanelSpec } from "@/components/home/HomePanels";

export const dynamic = "force-dynamic";

// The four money tiles and the GC schedule wait on EZ Binder until CC6 (spec §1).
const MONEY_TILES = [
  { label: "Open A/R", src: "EZ Binder · invoices" },
  { label: "Received this week", src: "EZ Binder · payments" },
  { label: "Open invoices", src: "EZ Binder · invoices" },
  { label: "Over 30 days", src: "EZ Binder · invoices" },
];

// Time of day from an ISO string, shown as-is (the stub stores Eastern-offset times).
function fmtTime(iso: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return "";
  let h = Number(m[1]);
  const mm = m[2];
  const ap = h < 12 ? "AM" : "PM";
  h = h % 12 || 12;
  return `${h}:${mm} ${ap}`;
}

function TodayPanel({
  events,
  due,
  anyConnected,
}: {
  events: DayEvent[];
  due: Card[];
  anyConnected: boolean;
}) {
  const empty = events.length === 0 && due.length === 0;
  return (
    <>
      <div className="today-legend">
        <span>
          <span className="sw" style={{ background: "#16181D" }} />
          Josh work
        </span>
        <span>
          <span className="sw" style={{ background: "#8A8F99" }} />
          Josh personal
        </span>
        <span>
          <span className="sw" style={{ background: "#2F5BD3" }} />
          Christine
        </span>
      </div>
      {events.map((e) => (
        <div key={e.id} className="today-row" data-testid="today-event">
          <div className="t">{e.allDay ? "All day" : fmtTime(e.startsAt)}</div>
          <div className="bar" style={{ background: e.color }} data-color={e.color} />
          <div className="main">
            <div className="title">{e.title}</div>
            <div className="sub">
              {e.label}
              {e.location ? ` · ${e.location}` : ""}
            </div>
          </div>
        </div>
      ))}
      {due.map((c) => (
        <div key={c.id} className="today-row" data-testid="today-due">
          <div className="t">Due</div>
          <div className="bar" style={{ background: "#C2410C" }} data-color="#C2410C" />
          <div className="main">
            <div className="title">{c.title}</div>
            <div className="sub">Kanban{c.project ? ` · ${c.project}` : ""}</div>
          </div>
        </div>
      ))}
      {empty ? (
        <p className="subtle" data-testid="today-empty">
          {anyConnected
            ? "Nothing on the calendars or due today."
            : "No calendars connected yet. Connect them in Settings."}
        </p>
      ) : null}
    </>
  );
}

function ComingSoon({ build }: { build: string }) {
  return (
    <p className="subtle" data-testid="coming">
      Coming in {build}.
    </p>
  );
}

function KanbanPanel({ cards }: { cards: Card[] }) {
  if (cards.length === 0) return <p className="subtle">No cards in progress on this board.</p>;
  return (
    <>
      {cards.map((c) => (
        <Link key={c.id} href={`/kanban?card=${c.id}`} className="home-kb-card" data-testid="home-kb-card">
          <div className="row">
            <span className={`kb-chip ${c.area === "personal" ? "personal" : c.area === "family" ? "family" : ""}`}>
              {c.area[0].toUpperCase() + c.area.slice(1)}
            </span>
            <span style={{ flex: 1 }} />
            <span className="mono subtle">{c.due ?? ""}</span>
          </div>
          <div className="title">{c.title}</div>
        </Link>
      ))}
    </>
  );
}

export default function HomePage() {
  const user = currentUser();
  if (!user) redirect("/signin");

  const board = getBoard(user.id, user.role) as Board;
  const layout = getHomeLayout(user.id);
  const date = todayEastern();
  const events = eventsOnDate(date);
  const due = cardsDueOn(board, date);
  const doing = inProgressCards(board);
  const anyConnected = connectedFeeds().length > 0;

  const panels: PanelSpec[] = [
    { key: "today", title: "Today", body: <TodayPanel events={events} due={due} anyConnected={anyConnected} /> },
    { key: "inbox", title: "Inbox", body: <ComingSoon build="CC4" /> },
    { key: "awaiting", title: "Awaiting reply", body: <ComingSoon build="CC4" /> },
    {
      key: "kanban",
      title: "Kanban · in progress",
      count: doing.length,
      openHref: "/kanban",
      body: <KanbanPanel cards={doing} />,
    },
  ];

  return (
    <>
      <h1 className="sr-only">Home</h1>

      <section aria-label="Money" className="money-tiles">
        {MONEY_TILES.map((m) => (
          <div key={m.label} className="money-tile">
            <div className="label">{m.label}</div>
            <div className="value mono" data-testid="money-waiting">
              Waiting on EZ Binder
            </div>
            <div className="src">{m.src} · CC6</div>
          </div>
        ))}
      </section>

      <HomePanels panels={panels} initialOrder={layout.order} initialCollapsed={layout.collapsed} />

      <section className="card gc-schedule">
        <h2>GC schedule · next 2 weeks</h2>
        <p className="subtle" data-testid="schedule-waiting">
          Waiting on EZ Binder. The schedule and proposals arrive in CC6.
        </p>
      </section>
    </>
  );
}
