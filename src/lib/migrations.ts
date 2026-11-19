import type Database from "better-sqlite3";

// Explicit migrations (handoff 7.5, process.md section 6). Each migration lists the database
// objects it should produce, so the Mac mini updater can read them back after applying it
// (handoff 7.4 step 5). Soft delete where data matters; no tenant id or row security.

export type ObjectSpec = { type: "table" | "index"; name: string };

export type Migration = {
  id: string;
  expects: ObjectSpec[];
  up: (db: Database.Database) => void;
};

export const MIGRATIONS: Migration[] = [
  {
    id: "0001_foundation",
    expects: [
      { type: "table", name: "users" },
      { type: "table", name: "sessions" },
      { type: "table", name: "user_prefs" },
      { type: "table", name: "secrets" },
      { type: "index", name: "idx_sessions_user" },
      { type: "index", name: "idx_sessions_expires" },
    ],
    up: (db) => {
      db.exec(`
        CREATE TABLE users (
          id             INTEGER PRIMARY KEY,
          username       TEXT NOT NULL UNIQUE,
          display_name   TEXT NOT NULL,
          role           TEXT NOT NULL CHECK (role IN ('josh', 'christine')),
          password_hash  TEXT NOT NULL,
          password_salt  TEXT NOT NULL,
          created_at     TEXT NOT NULL,
          deleted_at     TEXT
        );

        CREATE TABLE sessions (
          id          TEXT PRIMARY KEY,      -- sha256 of the opaque cookie token
          user_id     INTEGER NOT NULL REFERENCES users(id),
          created_at  TEXT NOT NULL,
          expires_at  TEXT NOT NULL
        );
        CREATE INDEX idx_sessions_user ON sessions(user_id);
        CREATE INDEX idx_sessions_expires ON sessions(expires_at);

        CREATE TABLE user_prefs (
          user_id  INTEGER NOT NULL REFERENCES users(id),
          key      TEXT NOT NULL,
          value    TEXT NOT NULL,
          PRIMARY KEY (user_id, key)
        );

        -- Secret store (handoff 1.1). Values are AES-256-GCM ciphertext only; the plaintext is
        -- never stored, logged or returned in full.
        CREATE TABLE secrets (
          name        TEXT PRIMARY KEY,
          iv          TEXT NOT NULL,
          ciphertext  TEXT NOT NULL,
          tag         TEXT NOT NULL,
          updated_at  TEXT NOT NULL,
          updated_by  TEXT
        );
      `);
    },
  },
  {
    id: "0002_kanban",
    expects: [
      { type: "table", name: "kanban_snapshots" },
      { type: "table", name: "app_settings" },
      { type: "table", name: "action_tokens" },
      { type: "table", name: "kanban_problems" },
      { type: "table", name: "card_seq" },
    ],
    up: (db) => {
      db.exec(`
        -- The app's snapshot of the last version of every card file it has seen (handoff §4.6).
        -- A cache for computing before/after when a file changes directly, not the source of truth.
        CREATE TABLE kanban_snapshots (
          card_id    TEXT PRIMARY KEY,
          fields     TEXT NOT NULL,   -- JSON of the snapshot fields (card.ts cardSnapshotFields)
          updated    TEXT NOT NULL,   -- the card's updated timestamp when last snapshotted
          seen_at    TEXT NOT NULL
        );

        -- Global app settings for a single household (handoff §4.8 Duet switch, and others later).
        CREATE TABLE app_settings (
          key    TEXT PRIMARY KEY,
          value  TEXT NOT NULL
        );

        -- Action-layer tokens, one row per writer (handoff §4.8). Only the sha256 of the token is
        -- stored; the plaintext is shown once at issue and never again. Revocable in Settings.
        CREATE TABLE action_tokens (
          writer      TEXT PRIMARY KEY CHECK (writer IN ('claude', 'duet')),
          token_hash  TEXT NOT NULL,
          created_at  TEXT NOT NULL,
          revoked_at  TEXT
        );

        -- Files that failed frontmatter validation on load (handoff §4.9 Problems view). A failing
        -- file is never dropped; it is listed here with the reason until it validates or is removed.
        CREATE TABLE kanban_problems (
          file     TEXT PRIMARY KEY,   -- path relative to the kanban folder, e.g. cards/CC-0007.md
          reason   TEXT NOT NULL,
          at       TEXT NOT NULL
        );

        -- Monotonic card id counter. Only the app assigns ids, in sequence (handoff §4.3). A single
        -- row holds the last number used; it never goes backwards even if a card is discarded.
        CREATE TABLE card_seq (
          id    INTEGER PRIMARY KEY CHECK (id = 1),
          last  INTEGER NOT NULL
        );
        INSERT INTO card_seq (id, last) VALUES (1, 0);
      `);
    },
  },
  {
    id: "0003_home",
    expects: [
      { type: "table", name: "calendar_feeds" },
      { type: "table", name: "calendar_events" },
      { type: "table", name: "weather_readings" },
      { type: "table", name: "feed_state" },
      { type: "index", name: "idx_calendar_events_feed" },
    ],
    up: (db) => {
      db.exec(`
        -- The three fixed Google calendars shown on Home (handoff §2 Today, §7.3). A feed is
        -- "connected" when Josh signs it in from Settings; the OAuth token lives in the secret
        -- store (spec §3), never here. color is the per-person colour from the mockup legend.
        CREATE TABLE calendar_feeds (
          slug          TEXT PRIMARY KEY,
          label         TEXT NOT NULL,
          owner         TEXT NOT NULL CHECK (owner IN ('josh', 'christine')),
          color         TEXT NOT NULL,
          sort          INTEGER NOT NULL,
          connected_at  TEXT          -- NULL until Josh connects it in Settings
        );
        INSERT INTO calendar_feeds (slug, label, owner, color, sort) VALUES
          ('josh_work',     'Josh work',          'josh',      '#16181D', 1),
          ('josh_personal', 'Josh personal',      'josh',      '#8A8F99', 2),
          ('christine',     'Christine personal', 'christine', '#2F5BD3', 3);

        -- Cached calendar events, replaced per feed on each Refresh (handoff §5.2, §7.3). No AI.
        CREATE TABLE calendar_events (
          id         TEXT PRIMARY KEY,   -- feed slug + external event id
          feed       TEXT NOT NULL REFERENCES calendar_feeds(slug),
          title      TEXT NOT NULL,
          starts_at  TEXT NOT NULL,      -- ISO-8601; all-day events use the date at 00:00
          ends_at    TEXT,
          all_day    INTEGER NOT NULL DEFAULT 0,
          location   TEXT,
          fetched_at TEXT NOT NULL
        );
        CREATE INDEX idx_calendar_events_feed ON calendar_events(feed);

        -- The last weather reading for the saved zip (handoff §2 top bar, §7.3). request_url is the
        -- request built from the saved zip, kept so a zip change is visible in the request (spec
        -- check 3). Weather comes from a free source with no paid key (spec §2).
        CREATE TABLE weather_readings (
          zip         TEXT PRIMARY KEY,
          temp_f      INTEGER NOT NULL,
          conditions  TEXT NOT NULL,
          rain_pct    INTEGER NOT NULL,
          hi_f        INTEGER NOT NULL,
          lo_f        INTEGER NOT NULL,
          request_url TEXT NOT NULL,
          fetched_at  TEXT NOT NULL
        );

        -- Health of each live feed, shown in the left-menu feed list (handoff §2, mockup Main).
        -- Updated on each Refresh. status is 'ok' or 'error'; detail is a short human note.
        CREATE TABLE feed_state (
          feed    TEXT PRIMARY KEY,
          status  TEXT NOT NULL,
          detail  TEXT NOT NULL,
          at      TEXT NOT NULL
        );
      `);
    },
  },
  {
    id: "0004_inbox_email",
    expects: [
      { type: "table", name: "awaiting_dismissed" },
      { type: "table", name: "intake_seen" },
    ],
    up: (db) => {
      db.exec(`
        -- Awaiting reply threads Josh has marked "No reply needed" (handoff §2, spec §1). Hiding is
        -- per thread only, not future emails in it; a thread id stays here until it reappears with
        -- new activity. Rule-based, no AI. Gmail threads themselves are never stored in the app.
        CREATE TABLE awaiting_dismissed (
          thread_id  TEXT PRIMARY KEY,
          at         TEXT NOT NULL
        );

        -- Intake messages already turned into a pending note (handoff §4.4, §7.3). The intake poll
        -- (email and text-to-email) is "on arrival"; this keeps a second poll over the same message
        -- from creating a duplicate note. source_ref is the Gmail message id; note_id is the N-id.
        CREATE TABLE intake_seen (
          source_ref  TEXT PRIMARY KEY,
          note_id     TEXT NOT NULL,
          at          TEXT NOT NULL
        );
      `);
    },
  },
];

// Other inbox/email settings (handoff §2, §2.1, §8.7) live in app_settings (migration 0002), a
// key/value table: the Shortcut token hash, the intake address, the Gmail connect time and the
// editable nudge template B. No new table is needed for them.

// Apply any migrations not yet recorded in schema_migrations. Returns the ids applied.
export function runMigrations(db: Database.Database): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          TEXT PRIMARY KEY,
      applied_at  TEXT NOT NULL
    );
  `);
  const done = new Set(
    db.prepare("SELECT id FROM schema_migrations").all().map((r) => (r as { id: string }).id),
  );
  const applied: string[] = [];
  const record = db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)");
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    const tx = db.transaction(() => {
      m.up(db);
      record.run(m.id, new Date().toISOString());
    });
    tx();
    applied.push(m.id);
  }
  return applied;
}

// Every object every migration says it should produce (handoff 7.4 step 5).
export function expectedObjects(): ObjectSpec[] {
  return MIGRATIONS.flatMap((m) => m.expects);
}
