# CC2 status: kanban storage and board

Branch: cc2-kanban. Spec: docs/specs/CC2-BUILD-SPEC.md. Handoff sections: 3.1, 3.2, 4, 5.4.

## RESUME

### Josh's words (verbatim, from spec §0)

- 2026-11-09 13:10, answers: "1. yes 2. yes 3. yes" (build from scratch; glass theme; kanban stored as Markdown files
  that Claude and Duet can edit).
- 2026-11-09 14:47, on who writes kanban log lines: "i dont follow. you decide" (decided: only the app writes them).
- Requirements: handoff sections 3.1, 3.2, 4 and 5.4. Layout: docs/mockup/Kanban.dc.html.

### Starting prompt (verbatim)

Unattended run in a FRESH session, started by scripts/run_chain.py. Your job is ONLY build CC2.
1. Read CLAUDE.md, docs/claude/chain.md and the handoff sections your spec names. If docs/specs/CC2-BUILD-SPEC.md is not on main, bring it
   from origin/docs/next-builds with your first commit.
2. git fetch origin. If origin/cc2-kanban exists: check it out, report git status (never discard uncommitted work), read
   docs/sessions/CC2-status.md and continue from PICK UP HERE. Otherwise create cc2-kanban from origin/main and the
   status file with a RESUME block quoting the spec's section 0 and this prompt verbatim.
3. Build docs/specs/CC2-BUILD-SPEC.md per docs/process.md section 4 (decide and log; hard stops only). Commit and push the feature branch
   after every step. ONE deliberate CI run. Keep a tool call printing output at least every 20 minutes.
4. No production grant. Production is Josh's Mac mini, which build sessions never touch (handoff section 7.5). Migrations land with the code and the Mac mini updater applies them. No real outside calls: use the stubs. No real email, ever.
5. Land per the landing rule as adapted in CLAUDE.md (handoff section 7.5). The merge commit message MUST start with
   "[Merge] CC2 (". The Mac mini updater deploys and smoke-checks after the merge (handoff section 7.4). Record the
   landing in chain.md and the status file.
6. Then STOP. Do not start the next build. If a hard stop or a question for Josh blocks landing, write it in the status
   file's Questions section (plain text, full question, options, recommendation), push, and end. If the status file
   already holds questions with NO recorded answer, change nothing and end at once, saying so: Josh answers through the
   chat session or the Command Center dashboard, which record the answers in the status file.

### Grant

None. Production is the Mac mini; build sessions never touch it, its database or the real kanban folder (handoff 7.5).
No real outside calls (use stubs). No real email, ever. Migrations land with the code; the Mac mini updater applies them.

### Hard stops (wait for Josh)

- A production pre-read or read-back that doesn't match what was committed (not applicable: no production access).
- A failed deploy or smoke check after a merge (the updater does this on the Mac mini, not the build session).
- Any production data write that wasn't granted by name.
- Anything that can't be undone.

### Later rulings (verbatim, with time)

(none yet this build)

## Decided without asking

- D-1 Kanban DB-side state (snapshot cache, app_settings, action_tokens, kanban_problems, card id
  sequence) lives in SQLite migration 0002_kanban; the cards themselves stay as files (handoff §4:
  no database table for cards). Reason: handoff §4.6 says the app keeps a snapshot of each card to
  compute before/after; persisting it means hand-edit diffs survive a restart. Changes no ruling,
  writes no real data, undoable.
- D-2 No third-party YAML dependency. A small flat frontmatter parser (src/lib/kanban/frontmatter.ts)
  for card and pending files, and a constrained board.yaml reader/writer the app fully controls.
  Reason: card frontmatter is flat key/value with flow lists; keeps the Mac mini self-contained and
  CI free of surprises; unknown fields are preserved (handoff §4.7 rule 6).
- D-3 `server-only` is stubbed under Vitest (tests/unit/stubs/server-only.ts) so server modules can
  be unit-tested; it is a build-time guard with no runtime. Also added `@/` alias to vitest.config.
- D-4 The local `kanban/` folder at the repo root is gitignored; the real kanban folder lives on the
  Mac mini and is never committed from a build session (handoff §7.5).
- D-5 Timestamps are stored with the America/New_York offset (e.g. 2026-11-09T13:20:00-05:00),
  DST-aware, matching handoff §4.2. Helper src/lib/kanban/time.ts.
- D-6 The folder watcher (handoff §4.9) is a 500 ms polling reconciler, not fs.watch. Reason:
  polling is robust across macOS/editors and avoids missed/duplicated fs events; a sub-second poll
  still meets the "within a second / within 2 seconds" checks (handoff §11 checks 1, 3). Because the
  app updates its snapshot the moment it writes a file, a self-write produces no diff, so the app
  never logs its own writes (handoff §4.9 "ignores watch events for files it just wrote").
- D-7 App-automatic archive (30-day move) logs with actor `unknown` — no person makes it; the actor
  enum has no "app" value. Restore re-opens the card to the Inbox stage with done/discarded stamps
  cleared, so a restored old card is not immediately re-archived.
- D-8 Removed `import "server-only"` from the kanban lib modules. Reason: the real `server-only`
  package throws whenever it is loaded outside a React-Server-Components bundle, so Playwright's
  globalSetup (which seeds the kanban folder by importing these modules) could not load them. The
  modules stay server-only in practice because they import node:fs / better-sqlite3 — a client
  bundle importing them fails the build regardless. Vitest still aliases server-only to a stub for
  the CC1 modules that keep the guard. Changes no runtime behaviour, undoable.
- D-9 The Quick add (Ctrl K) dialog is rendered via a React portal into document.body. Reason: an
  ancestor `.card` uses `backdrop-filter`, which makes a `position: fixed` child a containing block
  trapped behind the board columns; the columns then intercept the click. The portal escapes it.
- D-10 e2e seeds a kanban folder and action tokens in global-setup; CI and Playwright webServer are
  passed CC_KANBAN_DIR so both read the same folder. Tokens are written to .e2e/tokens.json for the
  route tests. `.e2e/` is gitignored.

## Questions

(none)

## Progress

- Step 0: branch cc2-kanban from origin/main; brought CC2-BUILD-SPEC.md from origin/docs/next-builds; wrote this
  status file. hooks path set to scripts/hooks.
- Step 1: kanban storage core — paths, frontmatter parse/serialize (unknown fields survive), card
  parse/validate + serialize, board.yaml read/write, atomic write + re-read-before-write store,
  DB-backed state (id sequence, settings, problems, snapshots). Migration 0002_kanban (5 tables).
  typecheck 0; unit 34/34 (kanban-storage 11/11 new).

- Step 2: activity log (JSONL per month, sequential L-ids, before/after, actors, run ids), snapshot
  differ (diff/classify), revert field application (applyFields). unit 39/39.
- Step 3: reconciler (500 ms poll) — new/ pickup (id, move, log create), card validation + Problems
  (not dropped), direct-change logging with attribution (actor unknown fallback), 30-day
  archive + restore, source_ref dedup, git backup (commitKanban + hourly), context + AGENTS.md
  generation, Eastern timestamps. typecheck 0; lint 0; unit 50/50 (kanban-reconciler 11/11 new).

- Step 4: action layer (add/update/move/append_note/read/list + revert), pending notes
  (create/suggest/confirm/dismiss), per-writer tokens (sha256 stored, issue/revoke/resolve), Duet
  switch (off by default; Duet token refused when off), Claude/Duet limits (no done/discarded, no
  board changes, body append-only) enforced in the action layer; source_ref dedup; POST /api/action
  route (Bearer token, command dispatch, HTTP codes). typecheck 0; lint 0; unit 65/65
  (kanban-actions 15/15 new).

- Step 5: UI — /kanban board (5 columns, area + project filters, J/C/B badges, "Added by Claude/
  Duet", board from the global toggle), card detail panel (stage select, area/project/due, Show on
  boards checkboxes, notes save, history with Revert on Claude/Duet lines + changed-again confirm,
  Discard, context path), Quick add (Ctrl+K + "+ Card"), /kanban/problems page, Settings "Kanban
  action layer" (Duet switch, per-writer token issue/revoke shown once). Nav: Kanban + Problems now
  real links. Column defs moved to client-safe types.ts. typecheck 0; lint 0; build 0 (10 routes);
  unit 65/65.

- Step 6: tests + CI. Added search-across-archive + restore (handoff §11 check 8 "search finds
  them"). e2e: check4-kanban (board + card panel per login, Added-by-Claude, quick add, hand-edit
  reload) and kanban-tokens (no token 401, Claude add/list ok, Claude done 403 limit, Duet-off 403).
  Updated CC1 check1 to target Calendar (Kanban is now built). CI: added cc2-kanban to push
  branches; webServer gets CC_KANBAN_DIR. Local CI sequence each on its own line: LINT=0 TYPECHECK=0
  GENTYPES=0 TYPES_IN_SYNC=0 BUILD=0 UNIT=65/65; browser 18/18.

## Checks (spec §4) — evidence

Handoff §11 "Kanban storage":
1. Hand edit reloads within 2s — e2e check4 "a hand edit to a card file shows in the app" (PASS);
   the app reads files on each dynamic render and the 500 ms reconciler keeps the view current.
2. Invalid frontmatter → Problems, not dropped — unit kanban-reconciler "Problems" (2 cases).
3. new/ gets next id, moves to cards/ within a second — unit kanban-reconciler "new/ pickup".
4. Two writers both keep changes — unit kanban-reconciler "two writers at once".
5. Unknown fields survive a rewrite — unit kanban-storage + kanban-reconciler.
6. Every change has a log line with actor/run/before-after — unit kanban-log + actions.
7. Claude direct change → log actor claude + Revert undoes — unit kanban-reconciler + actions revert.
8. 30-day archive; search finds; restore works — unit kanban-reconciler archive/restore + searchCards.
9. Second Sync over same source_ref → no duplicate — unit kanban-reconciler + actions dedup.
10. Windows PC writes through the app only — /api/action needs a token (e2e kanban-tokens 401) and
    enforces limits; non-Mac-mini writers use the action layer (handoff §4.8).
11. Git commit after each Sync — commitKanban unit-tested; the Sync trigger itself is CC7.
Plus spec §4: (1) revert + changed-again — unit actions revert; (2) Claude/Duet limits — unit actions
+ e2e tokens; (3) Duet off refused — unit tokens + e2e; (4) browser reaches board + panel per login —
e2e check4.

## Landing

CC2 landed 2026-11-19.

- Deliberate CI run: 44455383320 (browser job failed: e2e global-setup wrote .e2e/tokens.json before
  the repo-root .e2e/ existed — ENOENT in CI where CC_DB_PATH/CC_KANBAN_DIR live under RUNNER_TEMP).
  Fix run: 44455624341 — both jobs success (Lint/types/build/unit; Browser tests). Budget used: 1
  deliberate + 1 fix, of 1 + 2 infrastructure + 2 fix.
- Landing rule (CLAUDE §3 / handoff §7.5): (1) CI green on the branch; cc2-kanban was fast-forwardable
  onto current main dc32000; the only commits after the CI-green commit a747852 are docs (chain.md and
  this status file), named in the merge message. (2) Every agreed check passed with its number — see
  the "Checks (spec §4) — evidence" section above: handoff §11 "Kanban storage" 1-11 and spec §4 1-4;
  unit 65/65, browser 18/18.
- Migration 0002_kanban lands with the code; the Mac mini updater applies it (handoff §7.5). Expected
  objects: kanban_snapshots, app_settings, action_tokens, kanban_problems, card_seq.
- After merge: deploy and smoke are the Mac mini updater's job (handoff §7.4), not this build session.

## Waits on Josh

- Issue the Claude and Duet action-layer tokens in Settings → "Kanban action layer" when he wants
  Claude or Duet to edit cards over the tunnel. Duet stays off until he turns the switch on.
- Set the kanban folder path in Settings on the Mac mini — a local path outside iCloud, Dropbox and
  OneDrive (handoff §4.1). CC_KANBAN_DIR overrides it; the default is a `kanban/` folder beside the app.

## PICK UP HERE

CC2 is landed. Nothing more to do for CC2. STOP (do not start CC3).
