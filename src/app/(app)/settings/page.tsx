import { listSecretStatus } from "@/lib/secrets";
import SecretsPanel from "@/components/SecretsPanel";
import ActionLayerPanel from "@/components/kanban/ActionLayerPanel";
import ZipForm from "@/components/ZipForm";
import { tokenStatus } from "@/lib/kanban/tokens";
import { duetEnabled } from "@/lib/kanban/state";
import { listFeeds, getZip } from "@/lib/feeds/store";
import { gmailConnected, intakeAddress, nudgeTemplate } from "@/lib/feeds/gmail";
import { shortcutTokenStatus } from "@/lib/shortcut";
import InboxEmailPanel from "@/components/InboxEmailPanel";
import BuildsSettingsPanel from "@/components/builds/BuildsSettingsPanel";
import { listProjects } from "@/lib/builds/projects";
import { budgetState } from "@/lib/builds/budget";
import { connectCalendarAction, disconnectCalendarAction } from "./feed-actions";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const secrets = listSecretStatus();
  const statuses = tokenStatus();
  const duetOn = duetEnabled();
  const feeds = listFeeds();
  const zip = getZip();
  const shortcut = shortcutTokenStatus();
  const projects = listProjects();
  const budget = budgetState();
  return (
    <>
      <div className="card">
        <h1>Settings</h1>
        <p className="subtle">
          The keys the app needs for its outside connections. Enter or replace a key here. A saved
          value is never shown back in full — only that it is set and its last four characters.
        </p>
      </div>

      <div className="card">
        <h2>Home feeds</h2>
        <p className="subtle" style={{ marginTop: 4 }}>
          Connect each Google calendar so the Today panel shows its events, coloured by person.
          Connecting stores the calendar&rsquo;s sign-in in the secret store; Josh completes the
          Google sign-in on the Mac mini. Set the zip used for the weather in the top bar.
        </p>
        <div className="feed-list">
          {feeds.map((f) => (
            <div key={f.slug} className="secret-row" data-testid={`feed-${f.slug}`}>
              <span className="label">
                <span className="feed-swatch" style={{ background: f.color }} aria-hidden="true" />
                {f.label}
              </span>
              <span className="status" data-testid={`feed-status-${f.slug}`}>
                {f.connectedAt ? "connected" : "not connected"}
              </span>
              {f.connectedAt ? (
                <form action={disconnectCalendarAction}>
                  <input type="hidden" name="slug" value={f.slug} />
                  <button
                    className="btn ghost"
                    type="submit"
                    data-testid={`disconnect-${f.slug}`}
                    style={{ height: 36 }}
                  >
                    Disconnect
                  </button>
                </form>
              ) : (
                <form action={connectCalendarAction}>
                  <input type="hidden" name="slug" value={f.slug} />
                  <button
                    className="btn ghost"
                    type="submit"
                    data-testid={`connect-${f.slug}`}
                    style={{ height: 36 }}
                  >
                    Connect
                  </button>
                </form>
              )}
            </div>
          ))}
          <ZipForm zip={zip} />
        </div>
      </div>

      <div className="card">
        <h2>Inbox &amp; email</h2>
        <p className="subtle" style={{ marginTop: 4 }}>
          Connect Gmail for Awaiting reply and nudge drafts, set the address notes are emailed or
          texted to, edit the nudge template, and issue the iPhone Shortcut token. The app never
          sends email — nudges are Gmail drafts only.
        </p>
        <InboxEmailPanel
          gmailConnected={gmailConnected()}
          intakeAddress={intakeAddress()}
          template={nudgeTemplate()}
          shortcutIssued={shortcut.issued}
          shortcutCreatedAt={shortcut.createdAt}
        />
      </div>

      <div className="card">
        <h2>Keys</h2>
        <p className="subtle" style={{ marginTop: 4 }}>
          Each key is used by the build noted beside it. Setting a key early does no harm.
        </p>
        <SecretsPanel secrets={secrets} />
      </div>

      <div className="card">
        <h2>Kanban action layer</h2>
        <p className="subtle" style={{ marginTop: 4 }}>
          Tokens let Claude and Duet make card changes through the app over the tunnel. Duet is off
          by default. Each token shows once when issued; revoke it here to cut off access.
        </p>
        <ActionLayerPanel statuses={statuses} duetOn={duetOn} />
      </div>

      <div className="card">
        <h2>Software builds</h2>
        <p className="subtle" style={{ marginTop: 4 }}>
          The projects the Builds screen tracks, and the weekly build budget. The limit and warning
          are written to build-control; a blank limit records usage with no hold.
        </p>
        <BuildsSettingsPanel projects={projects} limit={budget.limit} warnPct={budget.warnPct} />
      </div>
    </>
  );
}
