import { getDb } from "./db";
import { openSecret, sealSecret, type SealedSecret } from "./crypto";
import { registerSensitive } from "./log";

// The keys the app needs a secret store for (handoff 1.1). Each is entered and replaced in
// Settings; values are never shown back in full. The feature that uses each key arrives in a later
// build; CC1 provides the store and the Settings UI only.
export type SecretDef = { name: string; label: string; usedIn: string };

export const SECRET_DEFS: SecretDef[] = [
  { name: "ez_binder_api_key", label: "EZ Binder API key", usedIn: "CC6" },
  { name: "ez_binder_webhook_secret", label: "EZ Binder webhook signing secret", usedIn: "CC6" },
  { name: "twilio_sid", label: "Twilio account SID", usedIn: "CC10" },
  { name: "twilio_token", label: "Twilio auth token", usedIn: "CC10" },
  { name: "ftc_api_key", label: "FTC (api.data.gov) key", usedIn: "CC10" },
  { name: "fcc_app_token", label: "FCC app token", usedIn: "CC10" },
  { name: "duet_token", label: "Duet access token", usedIn: "CC7" },
  { name: "shortcut_token", label: "iPhone Shortcut token", usedIn: "CC4 / CC10" },
  { name: "github_token", label: "GitHub token (Builds screen)", usedIn: "CC8" },
  { name: "google_oauth_client_id", label: "Google OAuth client ID", usedIn: "CC11" },
  { name: "google_oauth_client_secret", label: "Google OAuth client secret", usedIn: "CC11" },
];

const DEF_BY_NAME = new Map(SECRET_DEFS.map((d) => [d.name, d] as const));

// Google OAuth token bundles live in the secret store too (spec §3), but are not manual keys, so
// they never appear in the Settings "Keys" list (listSecretStatus iterates SECRET_DEFS only). The
// calendars use gcal_<feed slug>; Gmail uses gmail_oauth and the intake mailbox gintake_oauth. The
// connect flow sets and clears them.
export function calendarTokenName(feedSlug: string): string {
  return `gcal_${feedSlug}`;
}
function isGoogleTokenName(name: string): boolean {
  return name.startsWith("gcal_") || name === "gmail_oauth" || name === "gintake_oauth";
}

export type SecretStatus = { name: string; label: string; usedIn: string; isSet: boolean; hint: string };

function mask(plaintext: string): string {
  // Never reveal the value in full. Show only that it is set and its last 4 characters.
  const last4 = plaintext.slice(-4);
  return `••••${last4}`;
}

// Settings reads this. It returns status and a masked hint only — never the plaintext.
export function listSecretStatus(): SecretStatus[] {
  const db = getDb();
  const rows = db.prepare("SELECT name, iv, ciphertext, tag FROM secrets").all() as ({
    name: string;
  } & SealedSecret)[];
  const byName = new Map(rows.map((r) => [r.name, r] as const));
  return SECRET_DEFS.map((d) => {
    const row = byName.get(d.name);
    let hint = "";
    if (row) {
      try {
        hint = mask(openSecret(row));
      } catch {
        hint = "••••"; // key rotated or value unreadable; still reports "set"
      }
    }
    return { name: d.name, label: d.label, usedIn: d.usedIn, isSet: !!row, hint };
  });
}

export function setSecret(name: string, plaintext: string, updatedBy: string): void {
  if (!DEF_BY_NAME.has(name) && !isGoogleTokenName(name)) {
    throw new Error(`Unknown secret: ${name}`);
  }
  if (plaintext.length === 0) {
    throw new Error("A secret value cannot be empty.");
  }
  registerSensitive(plaintext); // so any later accidental log of this value is scrubbed
  const sealed = sealSecret(plaintext);
  getDb()
    .prepare(
      `INSERT INTO secrets (name, iv, ciphertext, tag, updated_at, updated_by)
       VALUES (@name, @iv, @ciphertext, @tag, @updated_at, @updated_by)
       ON CONFLICT(name) DO UPDATE SET
         iv = excluded.iv, ciphertext = excluded.ciphertext, tag = excluded.tag,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    )
    .run({
      name,
      iv: sealed.iv,
      ciphertext: sealed.ciphertext,
      tag: sealed.tag,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    });
}

// Remove a stored secret (e.g. disconnecting a calendar clears its token).
export function deleteSecret(name: string): void {
  getDb().prepare("DELETE FROM secrets WHERE name = ?").run(name);
}

// Read the plaintext for a feature that needs it (later builds). Returns null when unset.
export function getSecret(name: string): string | null {
  const row = getDb()
    .prepare("SELECT iv, ciphertext, tag FROM secrets WHERE name = ?")
    .get(name) as SealedSecret | undefined;
  if (!row) return null;
  const plaintext = openSecret(row);
  registerSensitive(plaintext);
  return plaintext;
}
