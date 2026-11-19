# CC9 status: touch screen

Branch: cc9-touch-screen. Spec: docs/specs/CC9-BUILD-SPEC.md. Handoff section: 6.

## RESUME

### Spec section 0 (Josh's words, verbatim)

- 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that session will
  create the repo and/or anything else needed and start the build"
- Requirements: handoff section 6. Layout: docs/mockup/Ambient.dc.html and AmbientBuilds.dc.html.

### Runner prompt (verbatim)

Unattended run in a FRESH session, started by scripts/run_chain.py. Your job is ONLY build CC9.
1. Read CLAUDE.md, docs/claude/chain.md and the handoff sections your spec names. If docs/specs/CC9-BUILD-SPEC.md is not on main, bring it
   from origin/docs/next-builds with your first commit.
2. git fetch origin. If origin/cc9-touch-screen exists: check it out, report git status (never discard uncommitted work), read
   docs/sessions/CC9-status.md and continue from PICK UP HERE. Otherwise create cc9-touch-screen from origin/main and the
   status file with a RESUME block quoting the spec's section 0 and this prompt verbatim.
3. Build docs/specs/CC9-BUILD-SPEC.md per docs/process.md section 4 (decide and log; hard stops only). Commit and push the feature branch
   after every step. ONE deliberate CI run. Keep a tool call printing output at least every 20 minutes.
4. No production grant. Production is Josh's Mac mini, which build sessions never touch (handoff section 7.5). Migrations land with the code and the Mac mini updater applies them. No real outside calls: use the stubs. No real email, ever.
5. Land per the landing rule as adapted in CLAUDE.md (handoff section 7.5). The merge commit message MUST start with
   "[Merge] CC9 (". The Mac mini updater deploys and smoke-checks after the merge (handoff section 7.4). Record the
   landing in chain.md and the status file.
6. Then STOP. Do not start the next build. If a hard stop or a question for Josh blocks landing, write it in the status
   file's Questions section (plain text, full question, options, recommendation), push, and end. If the status file
   already holds questions with NO recorded answer, change nothing and end at once, saying so: Josh answers through the
   chat session or the Command Center dashboard, which record the answers in the status file.

## State at start

origin/cc9-touch-screen did not exist. Created cc9-touch-screen from origin/main (clean). CC9-BUILD-SPEC.md was not on
main; brought it from origin/docs/next-builds in the first commit.

## Plan (per spec §1 and handoff §6)

A full-screen kiosk route `/touch`, outside the `(app)` chrome, dark glass with large text, reading the same data the
dashboard uses (no new outside calls, no AI).

- Step 1 — data layer: `src/lib/touch/settings.ts` (editable idle minutes, app_settings key `touch_idle_minutes`,
  default 3) and `src/lib/touch/view.ts` (assemble both screens for all three boards + alerts/banner + pure helpers).
  Unit tests `tests/unit/cc9-touch.test.ts`.
- Step 2 — UI: `/touch` layout + page + `/touch/data` poll route; `TouchScreen` client (swipe both ways, page dots,
  idle return, poll-driven jump to screen 2 on a new alert, board toggle, red banner); Settings idle field + action;
  a Nav entry point so each login reaches it by clicking (no direct URL). e2e `tests/e2e/cc9-touch.e2e.ts`.
- Step 3 — `docs/guides/touch_kiosk.md`; full unit+e2e run with tallies; one deliberate CI run; land.

## Decided without asking (CLAUDE §2: changes no ruling, widens no access, writes no real data, undoable)

- No new migration. CC9 is display-only; the one editable setting (idle minutes) reuses the existing `app_settings`
  table (migration 0002). No new database objects, so no 0009 migration.
- The board toggle on the touch screen is client-side state only (it switches screen 1's data in place, like the
  mockup); it does not persist to the DB and does not change the per-user dashboard board. Display-only friendly.
- Calendar events on screen 1 Today are filtered by board: Josh board shows owner=josh events, Christine board shows
  owner=christine events, Bishops shows all (shared household). Events carry owner josh|christine only; this makes the
  toggle visibly switch Today while staying consistent with the shared calendars.
- The touch screen is reachable from the main app by a Nav entry point ("Touch screen" → /touch) so each login reaches
  it by clicking (quality rule: no direct URL). The touch screen itself carries no app nav (display only).

## PICK UP HERE

Start Step 1.

## Checks (spec §4)

1. Touch screen returns to screen 1 after the idle time; swipe works both ways. — PENDING
2. A build entering Needs Josh, the hold starting, and a failed update each jump to screen 2 with the banner. — PENDING
3. The toggle switches screen 1's data; choosing Christine or Bishops on screen 2 jumps to screen 1. — PENDING

## Questions

(none)
</content>
