# CC3 status — Home screen, calendars, weather and Refresh

Branch: cc3-home. Spec: docs/specs/CC3-BUILD-SPEC.md. Handoff sections: 2 (top bar, panels), 5.2, 7.3.

## RESUME

Spec section 0 (Josh's words, verbatim):

- 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that session will
  create the repo and/or anything else needed and start the build"
- Requirements: handoff section 2 (top bar, Today and Kanban panels), 5.2, 7.3. Layout: docs/mockup/Main.dc.html.

Run prompt (verbatim):

> Unattended run in a FRESH session, started by scripts/run_chain.py. Your job is ONLY build CC3.
> 1. Read CLAUDE.md, docs/claude/chain.md and the handoff sections your spec names. If docs/specs/CC3-BUILD-SPEC.md is not on main, bring it
>    from origin/docs/next-builds with your first commit.
> 2. git fetch origin. If origin/cc3-home exists: check it out, report git status (never discard uncommitted work), read
>    docs/sessions/CC3-status.md and continue from PICK UP HERE. Otherwise create cc3-home from origin/main and the
>    status file with a RESUME block quoting the spec's section 0 and this prompt verbatim.
> 3. Build docs/specs/CC3-BUILD-SPEC.md per docs/process.md section 4 (decide and log; hard stops only). Commit and push the feature branch
>    after every step. ONE deliberate CI run. Keep a tool call printing output at least every 20 minutes.
> 4. No production grant. Production is Josh's Mac mini, which build sessions never touch (handoff section 7.5). Migrations land with the code and the Mac mini updater applies them. No real outside calls: use the stubs. No real email, ever.
> 5. Land per the landing rule as adapted in CLAUDE.md (handoff section 7.5). The merge commit message MUST start with
>    "[Merge] CC3 (". The Mac mini updater deploys and smoke-checks after the merge (handoff section 7.4). Record the
>    landing in chain.md and the status file.
> 6. Then STOP. Do not start the next build. If a hard stop or a question for Josh blocks landing, write it in the status
>    file's Questions section (plain text, full question, options, recommendation), push, and end. If the status file
>    already holds questions with NO recorded answer, change nothing and end at once, saying so: Josh answers through the
>    chat session or the Command Center dashboard, which record the answers in the status file.

## PICK UP HERE

Landed. Nothing to pick up. If reopened, the Mac mini updater deploys and smoke-checks after the
merge (handoff §7.4); nothing more for the build session.

## What was built

- Migration 0003_home: calendar_feeds (seeded with the three fixed calendars), calendar_events,
  weather_readings, feed_state. The Mac mini updater reads these objects back (handoff §7.4).
- Feeds (src/lib/feeds): stub by default everywhere (CC_LIVE_FEEDS=1 only on the Mac mini), so CI
  and build sessions make no real outside call. Refresh pulls weather + calendar events, no AI.
- Settings → Home feeds: connect/disconnect each of the three calendars (token in the secret store
  as gcal_<slug>, never shown in the Keys list); edit the weather zip (default 33472).
- Home: top bar (date, weather from the saved zip, search, Refresh "no AI", Sync placeholder [CC7],
  bell [CC8], Quick add, board toggle); four panels (Today, Inbox, Awaiting reply, Kanban in
  progress) that reorder (up/down or drag) and collapse, saved per user; money tiles and GC
  schedule show "Waiting on EZ Binder" (CC6); Inbox/Awaiting show "Coming in CC4". Left-menu live
  feed list driven by feed health.

## Checks (spec §4) — all pass

1. Home loads as each login; panels reorder and collapse and persist across a reload —
   tests/e2e/cc3-home-panels.e2e.ts (josh and christine).
2. Stubbed calendars: events from all three in their person colours (#16181D, #8A8F99, #2F5BD3)
   plus a due card (#C2410C) — tests/e2e/cc3-today.e2e.ts; data layer in tests/unit/feeds.test.ts.
3. Changing the zip in Settings changes the weather source request (stubbed) —
   tests/e2e/cc3-weather-zip.e2e.ts (79°→72° on 33472→90210) and tests/unit/feeds.test.ts.
4. Refresh makes no Claude call — tests/unit/refresh-no-ai.test.ts (static scan of the refresh-path
   files + a run with no AI client in the path; control proves the scanner fires) and
   tests/e2e/cc3-refresh.e2e.ts (button labelled "no AI", runs, no AI request from the browser).
5. The board toggle changes the Kanban panel's cards — tests/e2e/cc3-board-kanban.e2e.ts.

Tallies: unit 75/75, browser 24/24 (local and CI). CI green: run 44459153324, both jobs.

## Decided without asking

- No standalone Calendar screen in CC3. Phase 3 scope (handoff §12) is "Home layout, panels, Google
  calendars, weather, Refresh"; the spec's "What Josh gets" lists the Today panel and the Settings
  connect flow, not a Calendar screen. The left-menu "Calendar" item stays a later-build
  placeholder. See the Questions section: no phase currently assigns a standalone Calendar screen.
- Feeds default to stub everywhere; CC_LIVE_FEEDS=1 (only on the Mac mini) uses the live path. Live
  weather uses free keyless sources (api.zippopotam.us + Open-Meteo); live calendars return nothing
  until Josh completes his Google sign-in. Guarantees no real outside call in CI or build sessions.
- Weather zip stored in app_settings; validated as 5 digits. Calendar OAuth tokens in the secret
  store under gcal_<slug>, excluded from the Settings Keys list.
- Quick add moved to the global top bar (the mockup places it there) and removed from the kanban
  page, so there is one Ctrl-K handler and one "+ Card" button.
- Board toggle on Home: calendar events are per person (not board data) so they always show; the
  Today due-cards and the Kanban-in-progress panel are board-scoped (check 5).
- Top-bar search routes to the kanban search until cross-screen search lands in CC5.
- A screen-reader-only "Home" heading keeps the layout matching the mockup (no visible page title)
  while the sign-in helper's heading check still holds.

## Questions

For Josh (not blocking CC3; the build is landed):

ANSWERED 2026-11-19 (CC11): Josh — "3. understood. i will test the system and see whats needed."
Chosen: A. No standalone Calendar screen now; the "Calendar" menu item stays a later-build
placeholder until Josh decides what it should show.

Q1. [CC3-ASK-1] No build phase in the plan (handoff §12) assigns a standalone "Calendar" screen,
though the left menu lists one. CC3 delivers calendars through the Home Today panel and the
Settings connect flow, which is what the CC3 spec's "What Josh gets" describes. Where should a full
Calendar screen live, if you want one?
Options: A) Leave the "Calendar" menu item as a later-build placeholder; add a Calendar screen to a
later phase when you decide what it should show. B) Drop the "Calendar" menu item; the Today panel
is enough. C) Add a Calendar screen in a small follow-up build.
My recommendation: A — the Today panel covers daily use now; defer the full screen until you can say
what it should show beyond Today, so it is built once to the right shape.
