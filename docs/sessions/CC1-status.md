# CC1 status: foundation, logins and the Mac mini updater

Branch: cc1-foundation. Spec: docs/specs/CC1-BUILD-SPEC.md. Handoff sections: 1, 1.1, 1.3, 7.4, 7.5.

## RESUME

### Josh's words (verbatim, from spec §0)

- 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that session will
  create the repo and/or anything else needed and start the build"
- Requirements: Josh's Command Center Build Handoff v3 (docs/specs/COMMAND-CENTER-HANDOFF.md). Rulings in force:
  docs/claude/chain.md. Layout: docs/mockup/.

### Starting prompt (verbatim)

Unattended run in a FRESH session, started by scripts/run_chain.py. Your job is ONLY build CC1.
1. Read CLAUDE.md, docs/claude/chain.md and the handoff sections your spec names. If docs/specs/CC1-BUILD-SPEC.md is not on main, bring it
   from origin/docs/next-builds with your first commit.
2. git fetch origin. If origin/cc1-foundation exists: check it out, report git status (never discard uncommitted work), read
   docs/sessions/CC1-status.md and continue from PICK UP HERE. Otherwise create cc1-foundation from origin/main and the
   status file with a RESUME block quoting the spec's section 0 and this prompt verbatim.
3. Build docs/specs/CC1-BUILD-SPEC.md per docs/process.md section 4 (decide and log; hard stops only). Commit and push the feature branch
   after every step. ONE deliberate CI run. Keep a tool call printing output at least every 20 minutes.
4. No production grant. Production is Josh's Mac mini, which build sessions never touch (handoff section 7.5). Migrations land with the code and the Mac mini updater applies them. No real outside calls: use the stubs. No real email, ever.
5. Land per the landing rule as adapted in CLAUDE.md (handoff section 7.5). The merge commit message MUST start with
   "[Merge] CC1 (". The Mac mini updater deploys and smoke-checks after the merge (handoff section 7.4). Record the
   landing in chain.md and the status file.
6. Then STOP. Do not start the next build. If a hard stop or a question for Josh blocks landing, write it in the status
   file's Questions section (plain text, full question, options, recommendation), push, and end. If the status file
   already holds questions with NO recorded answer, change nothing and end at once, saying so: Josh answers through the
   chat session or the Command Center dashboard, which record the answers in the status file.

### Grant

None. Production is the Mac mini; build sessions never touch it, its database or the real kanban folder (handoff 7.5).
No real outside calls (use stubs). No real email, ever. No production grant is needed: migrations land with the code and
the Mac mini updater (handoff 7.4) applies them.

### Hard stops (wait for Josh)

- A production pre-read or read-back that doesn't match what was committed (not applicable: no production access).
- A failed deploy or smoke check after a merge (the updater does this on the Mac mini, not the build session).
- Any production data write that wasn't granted by name.
- Anything that can't be undone.

### Later rulings (verbatim, with time)

(none yet this build)

## Decided without asking

- D-1 Stack: Next.js 14 (App Router) + React 18 + TypeScript; local database SQLite via
  better-sqlite3; Vitest (unit) + Playwright (browser); Node built-in `crypto` only (scrypt, AES-256-GCM).
  Reason: process.md measures speed with `next build && next start` (Next.js is the intended production
  build); a single-file local database fits a single-household host with no paid hosting; no third-party
  crypto. Changes no ruling, widens no access, writes no real data, undoable. Recorded in CLAUDE.md.
- D-2 Desktop window is the browser in app mode (no Electron); the touch-screen kiosk (CC9) is Chromium
  kiosk. Reason: lighter, same glass UI, nothing to package.
- D-3 Secure tunnel is Cloudflare Tunnel (`cloudflared`), free, no hosting. The one account step is in
  docs/install-mac.md (answers chain.md "Tunnel account for remote access").
- D-4 Fonts use a system/`IBM Plex` CSS stack, not a Google Fonts fetch, so the app makes no outside call
  (keeps CI free of real outside calls and the Mac mini self-contained).
- D-5 The repo smoke check (handoff 7.4 step 6) covers for CC1: the app answers and both logins reach
  Home. The kanban-loads check is added in CC2 and the touch-screen reconnect check in CC9, since those
  screens do not exist yet. Logged because it narrows the smoke check for now.
- D-6 Seed passwords come from the environment (`CC_JOSH_PASSWORD`, `CC_CHRISTINE_PASSWORD`), defaulting to
  dev values for CI/local; the install step sets the real ones on the Mac mini. No real secret is committed.
- D-7 Christine's role is stored as `christine`; she sees everything (same menu). Her floor "cannot edit
  kanban files directly" is enforced in CC2, when kanban editing exists.
- D-8 CI runs on push to cc1-foundation/main and PRs to main. GitHub Actions honours `[skip ci]` natively,
  so only the one deliberate ALLOW_CI=1 push triggers a run.

## Questions

(none)

## Progress

- Step 1 commit 1bdcbf0: scaffold (Next 14.2.35 after security bump, TS, SQLite, Vitest, Playwright);
  stack recorded in CLAUDE.md. typecheck 0, build 0, lint 0.
- Step 2 commit 98d97cb: database, migrations (0001_foundation) with read-back of 6/6 expected objects,
  crypto, users/prefs/secrets, seed, generated types. migrate/seed/gen-types run clean.
- Step 3 commit 1c5d396: redaction logger + session/auth (scrypt passwords, sha256 session cookie).
- Step 4 commit f45b059: glass UI shell (top bar, left menu with "Coming in a later build" items, per-user
  board toggle), sign-in, Home, Settings secret store. Build 0, lint 0; live smoke: /signin 200,
  signed-out /home -> 307 /signin.
- Step 5 commit 18ebe58: Mac mini updater (core + real ops + run loop), repo smoke check, sync lock,
  install-mac.sh with --dry-run, docs/install-mac.md, health + signin routes. Dry-run changes nothing;
  live smoke PASS (app answers, josh+christine reach Home); wrong password -> 401.
- Step 6 (this step): tests + CI. unit 23/23; browser 9/9 (checks 1,2,3 + route permission map + health).
  Local CI sequence each read on its own line: LINT=0 TYPECHECK=0 GENTYPES=0 TYPES_IN_SYNC=0 BUILD=0 UNIT=0.

## Landing

CC1 landed 2026-11-19.

- Merge commit 709b076 on main, message starts "[Merge] CC1 (foundation, logins, Mac mini updater)".
- One deliberate CI run: 44449650659, conclusion success — job "Lint, types, build, unit tests": success;
  job "Browser tests": success. (Budget used: 1 of 1 + 2 + 2.)
- Landing rule (CLAUDE §3 / handoff 7.5): (1) CI green on the branch, which was fast-forwardable onto
  current main b2080a4 — met. (2) Every agreed check passed with its number:
  - Check 1 — each login signs in and reaches Home and Settings from the menus: PASS (e2e check1, josh +
    christine, + "Coming in a later build" on a not-built item).
  - Check 2 — wrong password refused; signed-out reach nothing but sign-in: PASS (e2e check2).
  - Check 3 — board toggle survives a restart, per user: PASS (e2e check3).
  - Check 4 — a written secret appears in no log line: PASS (unit secret-no-log; also masked, ciphertext).
  - Check 5 — updater backs up/applies/smoke-checks; a failing smoke restores prior version + database and
    records the alert: PASS (unit updater, 6 cases incl. apply/read-back/smoke rollback).
  - Check 6 — install script dry-run tested in CI: PASS (unit install-dryrun; changes nothing, exit 0).
  - Check 7 — pre-push hook refuses a push without [skip ci] unless ALLOW_CI=1: PASS (unit prepush-hook,
    temporary repo).
  - Migrations: handoff 7.5 removes landing condition 3; migrations land with the code and the Mac mini
    updater applies them.
- After merge: deploy and smoke are the Mac mini updater's job (handoff 7.4), not this build session.

## Waits on Josh

- Install Command Center on the Mac mini once: `cd command-center && sh scripts/install-mac.sh`
  (docs/install-mac.md). It sets Josh's and Christine's passwords and starts the app + updater.
- The one account step for remote access: the Cloudflare tunnel, steps in docs/install-mac.md.

## PICK UP HERE

CC1 is landed. Nothing more to do for CC1. STOP (do not start CC2).
