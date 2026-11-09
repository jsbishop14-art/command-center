# CC1 build spec: foundation, logins and the Mac mini updater

## 0. Josh's words (verbatim)

- 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that session will
  create the repo and/or anything else needed and start the build"
- Requirements: Josh's Command Center Build Handoff v3 (docs/specs/COMMAND-CENTER-HANDOFF.md). Rulings in force:
  docs/claude/chain.md. Layout: docs/mockup/.

## 1. What Josh gets

- Command Center installs on the Mac mini with one command and a short guide (docs/install-mac.md), starts on its
  own after a restart, and stays running.
- It opens as a desktop window on the Mac mini, and on the Windows PC through the tunnel.
- Josh and Christine sign in with their own logins. Christine sees everything.
- The top bar and left menu from the mockup (Main.dc.html) in the glass theme. Menu items for screens not built yet
  show "Coming in a later build". The board toggle (Josh, Christine, Bishops) is remembered per user.
- Reachable from outside the home with login, through a secure tunnel. The guide tells Josh the one account step.
- A secret store for every key in handoff 1.1. Josh can enter and replace keys in Settings; values are never shown
  back in full.
- The Mac mini updater (handoff 7.4) from day one, so every later build goes live on its own, with backup, smoke
  check and rollback.

## 2. Scope

Handoff sections 1, 1.1, 1.3 (toggle only; data comes later), 7.4, 7.5. Repo setup per docs/process.md section 9
with the 7.5 changes: CLAUDE.md stack line, CI workflow, test harness with a seeded local database per CI job,
pre-push hook. Pick the stack and record it with the reason in CLAUDE.md.

## 3. Must stay true

- Nothing calls Claude. No real outside calls in CI.
- No Kanban Pro code or assets.
- Secrets never appear in logs, test output or the repo.
- The updater never runs while a Sync is in progress (Sync arrives in CC7; build the check now).

## 4. Checks (state each with its number at landing)

1. Browser test: each login signs in and reaches Home and Settings from the menus.
2. Wrong password is refused; signed-out users reach nothing but the sign-in page.
3. The board toggle choice survives a restart, per user.
4. A test writes a secret and asserts it appears in no log line.
5. Updater test: a simulated new merge is backed up, applied and smoke-checked; a simulated failing smoke check
   restores the previous version and database and records the alert.
6. The install script has a dry-run mode, tested in CI.
7. The pre-push hook refuses a push without [skip ci] unless ALLOW_CI=1 (test with a temporary repo).

## 5. Not in this build

Any data panels, kanban, calendars, email, EZ Binder, Sync, builds data, touch screen kiosk, phone lookup.

## 6. Grant

None (handoff 7.5).
