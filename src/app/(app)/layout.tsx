import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getBoard } from "@/lib/prefs";
import TopBar from "@/components/TopBar";
import Nav from "@/components/Nav";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = currentUser();
  // Signed-out users reach nothing but the sign-in page (spec check 2).
  if (!user) redirect("/signin");

  const board = getBoard(user.id, user.role);

  return (
    <div className="app-shell">
      <TopBar userName={user.display_name} board={board} />
      <div className="body">
        <Nav />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
