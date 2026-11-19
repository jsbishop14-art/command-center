"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TouchView, TouchScreen1, TrackerBar } from "@/lib/touch/view";
import { BOARDS, type Board } from "@/lib/boards";

// The ambient touch screen (handoff §6, spec §1, mockups Ambient.dc.html / AmbientBuilds.dc.html).
// Display only, apart from the board toggle and the swipe (spec §3). It swipes between any number of
// screens (here Today and Builds), shows page dots, returns to screen 1 after the idle time, and
// jumps to screen 2 with a red banner the moment a *new* build alert appears. The board toggle
// switches screen 1's data in place and never persists — a kiosk is shared, not a signed-in session.

const LABELS: Record<Board, string> = { josh: "Josh", christine: "Christine", bishops: "Bishops" };

const BAR_COLOR: Record<TrackerBar, string> = {
  done: "#6B7080",
  current: "#FB923C",
  needs: "#EF4444",
  todo: "rgba(255,255,255,0.12)",
};

export default function TouchScreen({
  initialView,
  idleMs,
  pollMs,
}: {
  initialView: TouchView;
  idleMs: number;
  pollMs: number;
}) {
  const [view, setView] = useState<TouchView>(initialView);
  const [screen, setScreen] = useState<number>(initialView.initialScreen - 1); // 0-based index
  const [who, setWho] = useState<Board>("josh");
  const [mounted, setMounted] = useState(false);

  // Alert keys we have already reacted to; a key not in here is a *new* alert and jumps to screen 2.
  const seen = useRef<Set<string>>(new Set(initialView.alertKeys));
  const SCREENS = 2; // Today, Builds (the swipe generalises to any count — spec §2)

  // ——— live clock ———
  const [clock, setClock] = useState<{ time: string; date: string }>({ time: "", date: "" });
  useEffect(() => {
    setMounted(true);
    const tick = () => {
      const d = new Date();
      let h = d.getHours();
      const ap = h < 12 ? "AM" : "PM";
      h = h % 12 || 12;
      const mm = String(d.getMinutes()).padStart(2, "0");
      setClock({
        time: `${h}:${mm} ${ap}`,
        date: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ——— poll for fresh data and jump on a new alert (spec §4 check 2) ———
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch("/touch/data", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const next = (await res.json()) as TouchView;
        if (!alive) return;
        setView(next);
        const fresh = next.alertKeys.filter((k) => !seen.current.has(k));
        if (fresh.length > 0) setScreen(1); // index 1 = screen 2
        // React to every current key; keys that cleared drop out so they can re-trigger later.
        seen.current = new Set(next.alertKeys);
      } catch {
        // a failed poll leaves the last-good view on screen
      }
    };
    const id = setInterval(poll, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pollMs]);

  // ——— idle: return to screen 1 after the idle time (handoff §6) ———
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setScreen(0), idleMs);
  }, [idleMs]);
  useEffect(() => {
    resetIdle();
    const on = () => resetIdle();
    window.addEventListener("pointerdown", on);
    window.addEventListener("touchstart", on);
    window.addEventListener("keydown", on);
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      window.removeEventListener("pointerdown", on);
      window.removeEventListener("touchstart", on);
      window.removeEventListener("keydown", on);
    };
  }, [resetIdle]);

  // ——— swipe (both ways), with page dots as the accessible equivalent ———
  const dragX = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    dragX.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragX.current === null) return;
    const dx = e.clientX - dragX.current;
    dragX.current = null;
    if (dx <= -40) setScreen((s) => Math.min(SCREENS - 1, s + 1));
    else if (dx >= 40) setScreen((s) => Math.max(0, s - 1));
  };

  // ——— board toggle (spec §3) ———
  const chooseBoard = (b: Board) => {
    setWho(b);
    // Choosing Christine or Bishops on screen 2 jumps to screen 1 (spec §4 check 3).
    if (screen === 1 && b !== "josh") setScreen(0);
  };

  const s1 = view.boards[who];

  return (
    <div
      className="touch-root"
      data-screen={screen + 1}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div className="touch-viewport">
        <div className="touch-track" style={{ transform: `translateX(-${screen * 100}%)` }}>
          <section className="touch-pane" aria-label="Today" data-testid="touch-screen-1" aria-hidden={screen !== 0}>
            <Screen1
              clock={clock}
              mounted={mounted}
              weatherWho={s1.who}
              data={s1}
              who={who}
              onChoose={chooseBoard}
              refreshedAgo={view.lastRefreshedAgo}
              syncedAgo={view.lastSyncedAgo}
            />
          </section>
          <section className="touch-pane" aria-label="Software builds" data-testid="touch-screen-2" aria-hidden={screen !== 1}>
            <Screen2 clock={clock} mounted={mounted} view={view} who={who} onChoose={chooseBoard} />
          </section>
        </div>
      </div>

      <nav className="touch-dots" aria-label="Screens">
        {Array.from({ length: SCREENS }, (_, i) => (
          <button
            key={i}
            type="button"
            className={i === screen ? "dot active" : "dot"}
            aria-label={`Screen ${i + 1}`}
            aria-current={i === screen ? "page" : undefined}
            data-testid={`touch-dot-${i + 1}`}
            onClick={() => setScreen(i)}
          />
        ))}
      </nav>
    </div>
  );
}

function Toggle({ who, onChoose }: { who: Board; onChoose: (b: Board) => void }) {
  return (
    <div className="touch-toggle" role="group" aria-label="Viewing">
      {BOARDS.map((b) => (
        <button
          key={b}
          type="button"
          className={b === who ? `active ${b}` : ""}
          aria-pressed={b === who}
          data-testid={`touch-toggle-${b}`}
          onClick={() => onChoose(b)}
        >
          {LABELS[b]}
        </button>
      ))}
    </div>
  );
}

function Clock({ clock, mounted, big }: { clock: { time: string; date: string }; mounted: boolean; big?: boolean }) {
  return (
    <div className={big ? "touch-clock big" : "touch-clock"}>
      <span className="time mono" data-testid="touch-clock">
        {mounted ? clock.time : "—"}
      </span>
      <span className="date">{mounted ? clock.date : ""}</span>
    </div>
  );
}

function Screen1({
  clock,
  mounted,
  data,
  who,
  onChoose,
  refreshedAgo,
  syncedAgo,
}: {
  clock: { time: string; date: string };
  mounted: boolean;
  weatherWho: string;
  data: TouchScreen1;
  who: Board;
  onChoose: (b: Board) => void;
  refreshedAgo: string;
  syncedAgo: string;
}) {
  return (
    <div className="touch-grid">
      <header className="touch-head">
        <Clock clock={clock} mounted={mounted} big />
        <div className="touch-head-right">
          <Toggle who={who} onChoose={onChoose} />
          <div className="touch-stats">
            {data.stats.map((s) => (
              <div key={s.label} className="stat">
                <div className="label">{s.label}</div>
                <div className={s.accent ? "value mono accent" : "value mono"} data-testid={`touch-stat-${s.label}`}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <section className="touch-card">
        <h2>Today · {data.who}</h2>
        <div className="touch-list" data-testid="touch-today">
          {data.today.length === 0 ? (
            <p className="touch-empty">Nothing on the calendars or due today.</p>
          ) : (
            data.today.map((t) => (
              <div key={t.id} className="today-row">
                <span className="bar" style={{ background: t.color }} />
                <span className="t mono">{t.time}</span>
                <span className="title">{t.title}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="touch-card">
        <h2>{data.who}&rsquo;s kanban · in progress</h2>
        <div className="touch-list">
          {data.doing.length === 0 ? (
            <p className="touch-empty">No cards in progress.</p>
          ) : (
            data.doing.map((k) => (
              <div key={k.id} className="doing-row">
                <div className="title">{k.title}</div>
                <div className="meta">
                  <span>{k.area}</span>
                  <span className="mono">{k.due}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="touch-card">
        <h2>Waiting on · Due this week</h2>
        <div className="touch-list">
          {data.waiting.length === 0 ? (
            <p className="touch-empty">Nothing waiting or due this week.</p>
          ) : (
            data.waiting.map((w) => (
              <div key={w.id} className="waiting-row">
                <span className={`tag ${w.tag.toLowerCase()}`}>{w.tag}</span>
                <span className="title">{w.title}</span>
                <span className="when mono">{w.when}</span>
              </div>
            ))
          )}
        </div>
        <div className="touch-foot">
          <span className="dot" /> Refreshed {refreshedAgo} · last Sync {syncedAgo} · display only
        </div>
      </section>
    </div>
  );
}

function Screen2({
  clock,
  mounted,
  view,
  who,
  onChoose,
}: {
  clock: { time: string; date: string };
  mounted: boolean;
  view: TouchView;
  who: Board;
  onChoose: (b: Board) => void;
}) {
  const b = view.builds;
  return (
    <div className="touch-grid builds">
      <header className="touch-head builds">
        <div className="touch-head-left">
          <Clock clock={clock} mounted={mounted} />
          <h1>Software builds</h1>
        </div>
        <Toggle who={who} onChoose={onChoose} />
      </header>

      {view.banner ? (
        <div className="touch-banner" role="alert" data-testid="touch-banner">
          <span className="warn-ico" aria-hidden="true">
            ▲
          </span>
          <div className="banner-text">
            <div className="banner-title">{view.banner.title}</div>
            <div className="banner-detail">{view.banner.detail}</div>
          </div>
        </div>
      ) : null}

      <section className="touch-card builds-rows">
        <div className="builds-head">
          <span>Build</span>
          <span>Queued</span>
          <span>Building</span>
          <span>Needs Josh</span>
          <span>Landed</span>
          <span className="r">Chain</span>
        </div>
        {b.projects.map((p) => (
          <div key={p.repo} className={p.red ? "builds-row red" : "builds-row"} data-testid={`touch-build-${p.repo}`}>
            <div className="name">
              <span>{p.name}</span>
              <span className={`state ${p.state.replace(/\W+/g, "-").toLowerCase()}`} data-testid={`touch-build-state-${p.repo}`}>
                {p.state}
              </span>
            </div>
            {p.bars.map((bar, i) => (
              <span key={i} className="tracker" style={{ background: BAR_COLOR[bar] }} />
            ))}
            <span className="phase mono r">{p.phase}</span>
          </div>
        ))}
      </section>

      <section className="touch-card">
        <div className="usage-bars">
          {b.usage.map((u) => (
            <div key={u.key} className="usage-row" data-testid={`touch-usage-${u.key}`}>
              <span className="label">{u.label}</span>
              <span className="track">
                <span
                  className="fill"
                  style={{
                    width: `${Math.min(100, u.pct ?? 0)}%`,
                    background: u.hold ? "#EF4444" : u.key === "dashboard" ? "#60A5FA" : "#ECEDEF",
                  }}
                />
              </span>
              <span className="value mono">{u.value}</span>
            </div>
          ))}
        </div>
        <h2>Recent</h2>
        <div className="touch-list">
          {b.activity.length === 0 ? (
            <p className="touch-empty">No recent build activity.</p>
          ) : (
            b.activity.map((a, i) => (
              <div key={i} className="activity-row">
                <span className="when mono">{a.when}</span>
                <span className="text">{a.text}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
