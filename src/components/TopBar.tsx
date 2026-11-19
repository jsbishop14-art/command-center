import { signOutAction } from "@/app/actions";
import BoardToggle from "./BoardToggle";
import type { Board } from "@/lib/prefs";

// Weather zip default (handoff 2: default 33472, editable in Settings). The weather feed itself
// connects in CC3; here the top bar shows the placeholder so the layout matches the mockup.
const DEFAULT_ZIP = "33472";

function today(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function TopBar({ userName, board }: { userName: string; board: Board }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="dot" />
        <div className="name">Command Center</div>
        <div className="date">{today()}</div>
      </div>

      <div className="chip muted" aria-label="Weather (connects in a later build)">
        <span className="mono">—°</span>
        <span>weather connects later · {DEFAULT_ZIP}</span>
      </div>

      <div style={{ flex: 1 }} />

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
