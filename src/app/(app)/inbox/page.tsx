import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { inboxNotes } from "@/lib/feeds/inbox-view";
import InboxNotes from "@/components/home/InboxNotes";

export const dynamic = "force-dynamic";

// The Inbox screen (handoff §2 left menu "Inbox (count)"). The same pending notes shown in the Home
// Inbox panel, in a full-width list. Reached from the left menu. Christine sees it too (handoff
// §1.1). Nothing becomes a card without Confirm (spec §1).
export default function InboxPage() {
  const user = currentUser();
  if (!user) redirect("/signin");
  const notes = inboxNotes();
  return (
    <div className="card">
      <h1>Inbox</h1>
      <p className="subtle" style={{ marginTop: 4 }}>
        Notes you email to the intake address, text to it, or send from the iPhone Shortcut land
        here. Confirm files a note as a card; Change lets you pick the project and boards first;
        Dismiss removes it. Nothing becomes a card until you confirm.
      </p>
      <div style={{ marginTop: 12 }}>
        <InboxNotes notes={notes} />
      </div>
    </div>
  );
}
