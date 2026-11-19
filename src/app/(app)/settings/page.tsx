import { listSecretStatus } from "@/lib/secrets";
import SecretsPanel from "@/components/SecretsPanel";
import ActionLayerPanel from "@/components/kanban/ActionLayerPanel";
import ZipForm from "@/components/ZipForm";
import { tokenStatus } from "@/lib/kanban/tokens";
import { duetEnabled } from "@/lib/kanban/state";
import { listFeeds, getZip } from "@/lib/feeds/store";
import { gmailConnected, intakeConnected, intakeAddress, nudgeTemplate } from "@/lib/feeds/gmail";
import { googleRedirectUri } from "@/lib/feeds/google";
import { shortcutTokenStatus } from "@/lib/shortcut";
import InboxEmailPanel from "@/components/InboxEmailPanel";
import BuildsSettingsPanel from "@/components/builds/BuildsSettingsPanel";
import { listProjects } from "@/lib/builds/projects";
import { budgetState } from "@/lib/builds/budget";
import TouchIdleForm from "@/components/TouchIdleForm";
import { getTouchIdleMinutes } from "@/lib/touch/settings";
import ScoringConfigPanel from "@/components/phone/ScoringConfigPanel";
import { getScoringConfig, SCORING_FIELDS } from "@/lib/phone/config";
import { connectGoogleAction, disconnectGoogleAction } from "./feed-actions";

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
  const touchIdle = getTouchIdleMinutes();
  const redirectUri = googleRedirectUri();
  const scoring = getScoringConfig();
  const scoringFields = SCORING_FIELDS.map((f) => ({ key: f.key as string, label: f.label }));
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
          Connect opens Google&rsquo;s own sign-in and stores the token in the secret store. Each
          calendar connects to whichever Google account owns it. Set the zip used for the weather in
          the top bar.
        </p>
        <p className="subtle" style={{ marginTop: 4 }}>
          Enter the Google OAuth client ID and secret below in <strong>Keys</strong>, and register
          this redirect URI in the Google client:{" "}
          <code className="mono" data-testid="google-redirect-uri">
            {redirectUri}
          </code>{" "}
          (see docs/guides/google_connect.md). An expired or revoked connection shows on the{" "}
          <strong>Problems</strong> screen with a Reconnect button.
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
                <form action={disconnectGoogleAction}>
                  <input type="hidden" name="target" value={`cal:${f.slug}`} />
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
                <form action={connectGoogleAction}>
                  <input type="hidden" name="target" value={`cal:${f.slug}`} />
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
          intakeConnected={intakeConnected()}
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

      <div className="card">
        <h2>Touch screen</h2>
        <p className="subtle" style={{ marginTop: 4 }}>
          The ambient touch screen beside the Mac mini. Set how long it waits, with no touch, before
          returning to screen 1 (Today). Open it from the <strong>Touch screen</strong> menu item.
        </p>
        <TouchIdleForm minutes={touchIdle} />
      </div>

      <div className="card">
        <h2>Phone lookup</h2>
        <p className="subtle" style={{ marginTop: 4 }}>
          The points each signal adds and the verdict thresholds (handoff §8.4). Tune these during
          testing; a higher threshold makes &ldquo;Likely telemarketer&rdquo; harder to reach. The
          Twilio, FTC and FCC keys are set above in <strong>Keys</strong>, and the iPhone Shortcut
          token in <strong>Inbox &amp; email</strong>.
        </p>
        <ScoringConfigPanel fields={scoringFields} config={scoring as unknown as Record<string, number>} />
      </div>
    </>
  );
}
