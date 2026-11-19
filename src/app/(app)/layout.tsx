import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getBoard } from "@/lib/prefs";
import { getWeather, getZip, getLastRefreshAt } from "@/lib/feeds/store";
import { getFeedStatuses } from "@/lib/feeds/status";
import { listPending } from "@/lib/kanban/pending";
import { buildsAlerts } from "@/lib/builds/view";
import TopBar from "@/components/TopBar";
import Nav from "@/components/Nav";

export const dynamic = "force-dynamic";

// A short "x ago" label for the last refresh (handoff §2 top bar). Rendered on the server; it
// updates whenever the layout re-renders (navigation or after a refresh).
function agoLabel(iso: string | null): string {
  if (!iso) return "not yet";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = currentUser();
  // Signed-out users reach nothing but the sign-in page (spec check 2).
  if (!user) redirect("/signin");

  const board = getBoard(user.id, user.role);
  const zip = getZip();
  const weather = getWeather(zip);
  const feeds = getFeedStatuses();
  const inboxCount = listPending().length;
  const alerts = buildsAlerts();

  return (
    <div className="app-shell">
      <TopBar
        userName={user.display_name}
        board={board}
        weather={weather}
        zip={zip}
        refreshAgo={agoLabel(getLastRefreshAt())}
        bellCount={alerts.bell}
      />
      <div className="body">
        <Nav feeds={feeds} inboxCount={inboxCount} buildsBadge={alerts.needsJosh} />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
