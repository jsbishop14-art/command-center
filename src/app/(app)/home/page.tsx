import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getBoard, getHomeLayout, type Board } from "@/lib/prefs";
import { todayEastern, nowEastern } from "@/lib/kanban/time";
import { eventsOnDate, connectedFeeds, type DayEvent } from "@/lib/feeds/store";
import { gmailConnected } from "@/lib/feeds/gmail";
import { inboxNotes, awaitingItems } from "@/lib/feeds/inbox-view";
import { inProgressCards, cardsDueOn } from "@/lib/kanban/view";
import type { Card } from "@/lib/kanban/types";
import HomePanels, { type PanelSpec } from "@/components/home/HomePanels";
import InboxNotes from "@/components/home/InboxNotes";
import AwaitingReply from "@/components/home/AwaitingReply";
import ProjectsGrid from "@/components/home/ProjectsGrid";
import { buildProjects } from "@/lib/deals/projects";
import MoneyTiles from "@/components/ezbinder/MoneyTiles";
import ScheduleGridView from "@/components/ezbinder/ScheduleGrid";
import { moneyTiles, scheduleGrid } from "@/lib/ezbinder/view";

export const dynamic = "force-dynamic";

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
  const notes = inboxNotes();
  const awaiting = awaitingItems(new Date(nowEastern()));
  const gmailOn = gmailConnected();
  const projects = buildProjects(board);
  const tiles = moneyTiles();
  const grid = scheduleGrid({ today: date });

  const panels: PanelSpec[] = [
    { key: "today", title: "Today", body: <TodayPanel events={events} due={due} anyConnected={anyConnected} /> },
    {
      key: "inbox",
      title: "Inbox",
      count: notes.length,
      openHref: "/inbox",
      body: <InboxNotes notes={notes} />,
    },
    {
      key: "awaiting",
      title: "Awaiting reply",
      count: gmailOn ? awaiting.length : null,
      body: <AwaitingReply items={awaiting} gmailConnected={gmailOn} />,
    },
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

      <MoneyTiles tiles={tiles} />

      <HomePanels panels={panels} initialOrder={layout.order} initialCollapsed={layout.collapsed} />

      <ProjectsGrid cards={projects} />

      <section className="card gc-schedule">
        <div className="gc-head">
          <h2>GC schedule · next 2 weeks</h2>
          <Link href="/schedule" className="subtle">
            Open schedule
          </Link>
        </div>
        <div className="gc-legend">
          <span>
            <span className="sw" style={{ background: "#15803D" }} /> Active
          </span>
          <span>
            <span className="sw" style={{ background: "#B45309" }} /> Sold, not started
          </span>
          <span>
            <span className="sw dashed" /> Proposal (you, rule or Claude)
          </span>
        </div>
        <ScheduleGridView grid={grid} />
      </section>
    </>
  );
}
