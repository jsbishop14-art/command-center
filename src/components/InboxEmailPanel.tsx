"use client";

import { useFormState } from "react-dom";
import {
  connectGmailAction,
  disconnectGmailAction,
  saveIntakeAddressAction,
  saveTemplateAction,
  resetTemplateAction,
  issueShortcutTokenAction,
  revokeShortcutTokenAction,
  type SaveState,
  type ShortcutTokenState,
} from "@/app/(app)/settings/inbox-actions";

// Settings panel for Inbox & email (handoff §2, §2.1, §8.7, spec §1): connect Gmail, set the intake
// address, edit template B, and issue/revoke the iPhone Shortcut token. The token's plaintext is
// shown once at issue and never again.

const saveInitial: SaveState = {};
const tokenInitial: ShortcutTokenState = {};

export default function InboxEmailPanel({
  gmailConnected,
  intakeAddress,
  template,
  shortcutIssued,
  shortcutCreatedAt,
}: {
  gmailConnected: boolean;
  intakeAddress: string;
  template: string;
  shortcutIssued: boolean;
  shortcutCreatedAt: string | null;
}) {
  const [intakeState, intakeForm] = useFormState(saveIntakeAddressAction, saveInitial);
  const [templateState, templateForm] = useFormState(saveTemplateAction, saveInitial);
  const [tokenState, tokenForm] = useFormState(issueShortcutTokenAction, tokenInitial);

  return (
    <div className="settings-grid">
      {/* Gmail connection */}
      <div className="secret-row">
        <div className="label">
          Gmail
          <span className="subtle" style={{ display: "block", fontWeight: 400 }}>
            Powers Awaiting reply and nudge drafts, and the note intake. Josh completes the Google
            sign-in on the Mac mini; the app never sends email.
          </span>
        </div>
        <div className="status" data-testid="gmail-status">
          {gmailConnected ? "connected" : "not connected"}
        </div>
        {gmailConnected ? (
          <form action={disconnectGmailAction}>
            <button className="btn ghost" type="submit" data-testid="gmail-disconnect">
              Disconnect
            </button>
          </form>
        ) : (
          <form action={connectGmailAction}>
            <button className="btn ghost" type="submit" data-testid="gmail-connect">
              Connect
            </button>
          </form>
        )}
      </div>

      {/* Intake address */}
      <form action={intakeForm} className="secret-row">
        <div className="label">
          Intake address
          <span className="subtle" style={{ display: "block", fontWeight: 400 }}>
            Notes emailed or texted to this address land in the Inbox.
          </span>
        </div>
        <input
          type="text"
          name="intake"
          defaultValue={intakeAddress}
          placeholder="josh+notes@worthprop.com"
          data-testid="intake-input"
          style={{ minWidth: 260 }}
        />
        <button className="btn ghost" type="submit" data-testid="intake-save">
          Save
        </button>
        {intakeState.ok ? (
          <span className="badge-set" role="status" data-testid="intake-saved">
            saved
          </span>
        ) : null}
        {intakeState.error ? (
          <span className="subtle" role="status">
            {intakeState.error}
          </span>
        ) : null}
      </form>

      {/* Template B */}
      <form action={templateForm} className="secret-row" style={{ alignItems: "flex-start" }}>
        <div className="label">
          Nudge template (B)
          <span className="subtle" style={{ display: "block", fontWeight: 400 }}>
            Used by Nudge. [first name] fills automatically; end at &ldquo;Thanks,&rdquo; — Gmail
            adds your signature.
          </span>
        </div>
        <textarea
          name="template"
          defaultValue={template}
          rows={3}
          data-testid="template-input"
          style={{ minWidth: 320, fontFamily: "inherit" }}
        />
        <button className="btn ghost" type="submit" data-testid="template-save">
          Save
        </button>
        {templateState.ok ? (
          <span className="badge-set" role="status" data-testid="template-saved">
            saved
          </span>
        ) : null}
        {templateState.error ? (
          <span className="subtle" role="status" data-testid="template-error">
            {templateState.error}
          </span>
        ) : null}
      </form>
      <form action={resetTemplateAction}>
        <button className="btn ghost" type="submit" data-testid="template-reset">
          Reset to default
        </button>
      </form>

      {/* Shortcut token */}
      <div className="secret-row">
        <div className="label">
          iPhone Shortcut token
          <span className="subtle" style={{ display: "block", fontWeight: 400 }}>
            Lets the note Shortcut post to the Inbox. Works only on the Shortcut routes; revoke to
            cut it off. Shown once at issue.
          </span>
        </div>
        <div className="status">
          {shortcutIssued ? (
            <span className="badge-set" data-testid="shortcut-status">
              issued
            </span>
          ) : (
            <span className="badge-unset" data-testid="shortcut-status">
              none
            </span>
          )}
          {shortcutIssued && shortcutCreatedAt ? (
            <span className="subtle" style={{ display: "block", fontWeight: 400 }}>
              {shortcutCreatedAt.slice(0, 10)}
            </span>
          ) : null}
        </div>
        <form action={tokenForm}>
          <button className="btn ghost" type="submit" data-testid="shortcut-issue">
            {shortcutIssued ? "Re-issue" : "Issue"}
          </button>
        </form>
        {shortcutIssued ? (
          <form action={revokeShortcutTokenAction}>
            <button className="btn ghost" type="submit" data-testid="shortcut-revoke">
              Revoke
            </button>
          </form>
        ) : null}
        {tokenState.token ? (
          <span className="badge-set" role="status" style={{ flexBasis: "100%" }}>
            New Shortcut token (shown once — copy it now):{" "}
            <code className="mono" data-testid="new-shortcut-token">
              {tokenState.token}
            </code>
          </span>
        ) : null}
      </div>
    </div>
  );
}
