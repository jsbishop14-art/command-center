"use client";

import { useTransition } from "react";
import { refreshAction } from "@/app/actions";

// Refresh (handoff §2, §5.2): pulls calendars and weather on demand, no AI. The label notes the
// last refresh time; it updates when the layout re-renders after the pull.
export default function RefreshButton({ ago }: { ago: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="chip"
      type="button"
      data-testid="refresh"
      disabled={pending}
      onClick={() => start(() => refreshAction())}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F4F4F1" strokeWidth="2" aria-hidden="true">
        <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
        <path d="M4 3v5h5" />
        <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
        <path d="M20 21v-5h-5" />
      </svg>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.15 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{pending ? "Refreshing…" : "Refresh"}</span>
        <span className="mono" style={{ fontSize: 10, color: "#b8bcc6" }}>
          no AI · {ago}
        </span>
      </span>
    </button>
  );
}
