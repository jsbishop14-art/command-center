"use client";

import Link from "next/link";
import { useState, useTransition, useRef, type ReactNode } from "react";
import { saveHomeLayoutAction } from "@/app/(app)/home/actions";

// The four Home panels, reorderable and collapsible, saved per user (handoff §2, spec check 1).
// Reorder by the up/down controls (accessible and test-stable) or by dragging the grip (mouse).
// Each change is persisted via a server action so it survives a restart. Panel bodies are rendered
// on the server and passed in, so this client component only owns order and collapsed state.

export type PanelSpec = {
  key: string;
  title: string;
  count?: number | null;
  openHref?: string | null;
  body: ReactNode;
};

export default function HomePanels({
  panels,
  initialOrder,
  initialCollapsed,
}: {
  panels: PanelSpec[];
  initialOrder: string[];
  initialCollapsed: string[];
}) {
  const [order, setOrder] = useState<string[]>(initialOrder);
  const [collapsed, setCollapsed] = useState<string[]>(initialCollapsed);
  const [, start] = useTransition();
  const dragKey = useRef<string | null>(null);

  const byKey = new Map(panels.map((p) => [p.key, p] as const));

  function persist(o: string[], c: string[]) {
    start(() => saveHomeLayoutAction(o, c));
  }

  function move(key: string, dir: -1 | 1) {
    const i = order.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    persist(next, collapsed);
  }

  function dropOnto(target: string) {
    const key = dragKey.current;
    dragKey.current = null;
    if (!key || key === target) return;
    const next = order.filter((k) => k !== key);
    next.splice(next.indexOf(target), 0, key);
    setOrder(next);
    persist(next, collapsed);
  }

  function toggle(key: string) {
    const next = collapsed.includes(key) ? collapsed.filter((k) => k !== key) : [...collapsed, key];
    setCollapsed(next);
    persist(order, next);
  }

  return (
    <div className="home-panels">
      {order.map((key) => {
        const p = byKey.get(key);
        if (!p) return null;
        const isCollapsed = collapsed.includes(key);
        return (
          <section
            key={key}
            className="home-panel"
            data-testid={`panel-${key}`}
            draggable
            onDragStart={() => {
              dragKey.current = key;
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dropOnto(key)}
          >
            <div className="home-panel-head">
              <span className="grip" aria-hidden="true" title="Drag to reorder">
                ⠿
              </span>
              <h2>
                {p.title}
                {p.count != null ? <span className="count"> {p.count}</span> : null}
              </h2>
              <span style={{ flex: 1 }} />
              {p.openHref ? (
                <Link href={p.openHref} className="panel-open" data-testid={`open-${key}`}>
                  Open
                </Link>
              ) : null}
              <button
                type="button"
                className="panel-btn"
                aria-label={`Move ${p.title} up`}
                data-testid={`up-${key}`}
                onClick={() => move(key, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="panel-btn"
                aria-label={`Move ${p.title} down`}
                data-testid={`down-${key}`}
                onClick={() => move(key, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="panel-btn"
                aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${p.title}`}
                aria-expanded={!isCollapsed}
                data-testid={`collapse-${key}`}
                onClick={() => toggle(key)}
              >
                {isCollapsed ? "▸" : "▾"}
              </button>
            </div>
            {!isCollapsed ? (
              <div className="home-panel-body" data-testid={`body-${key}`}>
                {p.body}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
