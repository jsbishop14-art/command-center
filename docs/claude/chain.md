# chain.md: Command Center build chain

## Build order

| # | Name | Branch | Spec | Handoff sections | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | CC1 | cc1-foundation | docs/specs/CC1-BUILD-SPEC.md | 1, 1.1, 1.3, 7.4, 7.5 | Landed |
| 2 | CC2 | cc2-kanban | docs/specs/CC2-BUILD-SPEC.md | 3.1, 3.2, 4, 5.4 | Landed |
| 3 | CC3 | cc3-home | docs/specs/CC3-BUILD-SPEC.md | 2 (top bar, panels), 5.2, 7.3 | Landed |
| 4 | CC4 | cc4-inbox-email | docs/specs/CC4-BUILD-SPEC.md | 2 (Inbox, Awaiting reply), 2.1, 4.4 | Landed |
| 5 | CC5 | cc5-deals-contacts | docs/specs/CC5-BUILD-SPEC.md | 2 (Projects), 3.3, 3.4, 4.8 | Landed |
| 6 | CC6 | cc6-ez-binder | docs/specs/CC6-BUILD-SPEC.md | 2 (money, schedule), 2.2, 7.2, 7.3 | Landed |
| 7 | CC7 | cc7-sync | docs/specs/CC7-BUILD-SPEC.md | 5 | Landed |
| 8 | CC8 | cc8-builds | docs/specs/CC8-BUILD-SPEC.md | 7.1 | Landed |
| 9 | CC9 | cc9-touch-screen | docs/specs/CC9-BUILD-SPEC.md | 6 | Landed |
| 10 | CC10 | cc10-phone-lookup | docs/specs/CC10-BUILD-SPEC.md | 8 | Landed |
| 11 | CC11 | cc11-mac-fixes-google | docs/specs/CC11-BUILD-SPEC.md | 2, 2.1, 2.2, 4.4, 7.2, 7.3, 7.4, 1.1 | Landed |

## Grants

None. Production is the Mac mini; build sessions never touch it (handoff 7.5). No real outside calls; no real email.

## Sources

- Requirements: docs/specs/COMMAND-CENTER-HANDOFF.md (Command Center Build Handoff v3, Josh, 2026-11-09).
- Layout: docs/mockup/ (exported from the approved mockup, 2026-11-09).
- EZ Binder contract: "EZ Binder API for Command Center: handoff" (EZ Binder build S156, 2026-10-23), copied to
  docs/specs/ when available. Build against a stub until Josh confirms S156 is live.

## Repos

- jsbishop14-art/command-center and jsbishop14-art/build-control. Public until the build is complete, then private
  (Josh, 2026-11-09 16:36). IronFrame414 is a collaborator with write access, so Claude sessions can push.

## Rulings in force (Josh's words verbatim, Eastern time)

- 2026-11-09 13:05, on Kanban Pro: "I want this audited for compatibility and ideas. Then, if suitable, i want to take
  the code as allowable and start my own repo". Outcome: its license is proprietary; no Kanban Pro code, assets or
  design files.
- 2026-11-09 13:09, answers: "1. #3 if it will save time 2. glass theme 3. no 4. yes". Meaning: an open-source base
  only if it saves time; glass theme; no Nimbalyst audit; audit saved.
- 2026-11-09 13:10, answers: "1. yes 2. yes 3. yes". Meaning: build from scratch; glass theme on every screen; kanban
  stored as Markdown files that Claude and Duet can edit.
- 2026-11-09 13:15: "approve" (glass mockup approved for handoff).
- 2026-11-09 14:47, on who writes kanban log lines: "i dont follow. you decide". Decided: only the app writes log
  lines; writers set last_actor and last_run (handoff 4.6).
- 2026-11-09 15:14, defining the Budget tile: "The Budget tile is the build budget from your PROCESS.md. You set a
  limit; when the builds reach it, you get a notification and the hold starts. During the hold, no new tickets start,
  in-progress work finishes, and you can override it. The tile shows how close the builds are to that limit and
  whether the hold is on. It covers the builds only, not the dashboard's Sync usage."
- 2026-11-09 15:19, answers to CC-ASK-1 to 6: "1. a 2. a 3. a 4. a 5. a 6. a". Meaning:
  1. Add the build budget (limit, notification, hold, override) to process.md and the runner, and define the tile.
  2. Build status comes from GitHub (status files, merge commits).
  3. Build stages are Queued, Building, Needs Josh, Landed.
  4. Josh answers build questions on the dashboard; the answer is written into the status file; Josh restarts the
     runner himself.
  5. After landing, the Mac mini pulls main, restarts and smoke-checks, rolling back on failure.
  6. process.md saved to the project.
- 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that session will create
  the repo and/or anything else needed and start the build"
- 2026-11-09 15:37: "nothing for this build will be saved or accessed from this windows machine"
- 2026-11-09 16:20: "a. I am on the mac now so anything needed can be written here as well"
- 2026-11-09 16:30, on where the repos live: "i want this on a different account" (not IronFrame414).
- 2026-11-09 16:32, answer to SETUP-ASK-5: "c". Meaning: wait for the account-creation limit, then a new account.
- 2026-11-09 16:36: "account jsbishop14-art. both repos created. they are public for now to utilize the free
  features. it must be changed when the build is complete". Meaning: repos on jsbishop14-art, public until the build
  is complete, then switched to private.
- 2026-11-09 16:39, answer to SETUP-ASK-6: "a". Meaning: commit everything as planned (handoff, specs, status files,
  chain.md, usage), accepting it is public until the build is complete.
- 2026-11-09 16:39, answers to SETUP-ASK-2 to 4: "2. a 3. a 4. a". Meaning:
  2. No weekly build budget limit for the first week; usage is recorded with no hold, then Josh sets a limit.
  3. The 15:37 ruling covers the setup work only; Command Center still opens on the Windows PC over the tunnel.
  4. Keep the build budget and the build-control repo.
- 2026-11-19 05:52, answers to the open asks: "1. a new address. evanmbishop23@gmail.com" (CC4-ASK-1 — the intake
  mailbox is a new Google account, evanmbishop23@gmail.com) and "2. i think claude can change the schedule"
  (EZB-ASK-1 — Claude may change the EZ Binder schedule).
- 2026-11-19 05:56, on how Josh/rule schedule moves are labeled in EZ Binder: "2a- yes if it is already built into
  the system." Meaning: Josh and slip-rule schedule-move proposals go to EZ Binder with X-EZB-Actor `claude` and a
  note naming the real source ("moved by Josh" / "moved by rule: <rule name>"); they stay proposals until Josh
  confirms them in EZ Binder (handoff §2.2, §7.2). Built in CC11.
- 2026-11-19 05:56, on the Calendar menu item (CC3-ASK-1): "3. understood. i will test the system and see whats
  needed." Meaning: no standalone Calendar screen now; the menu item stays a later-build placeholder.
- 2026-11-19 07:43: "im back on the windows machine. run fixes now" (go-ahead to build CC11).

## What waits on Josh

- Switching command-center and build-control to private when the build is complete.
- Weekly build budget limit (tokens), after the first week of real usage. Until set, usage is recorded with no hold.
- Tunnel account for remote access (CC1 guide says which and how).
- Installing Command Center on the Mac mini once, after CC1 lands (one command from CC1's guide).
- Connecting Google (calendars, Gmail) after CC3 and CC4 land. CC3 landed the calendar connect
  flow; CC4 landed Gmail: connect the three calendars and Gmail in Settings (Josh completes the
  Google sign-in on the Mac mini), set the weather zip if not 33472, and set the intake address
  (see the next line and CC4-ASK-1).
- Whether a standalone Calendar screen is wanted, and what it should show beyond the Home Today
  panel (CC3-ASK-1 in docs/sessions/CC3-status.md). No build phase assigns one; the menu item is a
  later-build placeholder until Josh decides.
- Intake email address for notes: set it in Settings → Inbox & email on the Mac mini, and issue the
  iPhone Shortcut token there (CC4-ASK-1 tables new vs alias; built configurable so either works).
- EZ Binder: confirming S156 is live, and the keys. CC6 landed the whole connection — money tiles,
  GC jobs, the GC schedule, the webhook receiver, the 90-minute sync and Josh/slip-rule proposals —
  all against the stub built from the S156 contract. To go live on the Mac mini, set the EZ Binder
  API key and webhook signing secret in Settings, set app settings ezb_base_url and ezb_live=1, and
  answer EZB-ASK-1 (does the S156 API accept proposals with X-EZB-Actor josh and rule? ideally add
  the S156 contract to docs/specs/). Until ezb_live is on, the stub stands in and an unconnected Mac
  mini shows no EZ Binder data. The Awaiting-reply 1-day rule and deal estimate status still use the
  CC5 synchronous stubs (identical values); they move to the async client at go-live.
- Sync with Claude live wiring (CC7 landed against the Claude stub): on the Mac mini set
  CC_LIVE_AI=1 so Sync runs Claude through the Claude Code command line (signed in to Josh's plan,
  no API key, the same way the build runner does). Until then the stub stands in, with deterministic
  output and token counts. Optional: set app setting ai_weekly_plan_tokens for the Sync popup's
  "weekly plan %" tile (unset shows "—"; the Max plan has no hard cap on Sync, handoff §5.6).
- Builds screen live wiring (CC8 landed against the GitHub stub): on the Mac mini set the
  github_token in Settings → Keys (see docs/guides/github_token.md) and CC_LIVE_GITHUB=1 so the
  Builds screen reads the real repos and build-control, and writes answers and the budget to GitHub.
  Until then the stub stands in. Josh also creates the private build-control repo once and points
  each runner at it (BUILD_BUDGET_REPO), then sets the weekly build limit in Settings → Software
  builds (until set, usage is recorded with no hold — chain.md 2026-11-09 16:39). Tracked projects
  are editable in the same place.
- Phone lookup go-live (CC10 landed against stubs): set the three keys in Settings → Keys (Twilio
  account SID + auth token, FTC api.data.gov key, FCC app token) and CC_LIVE_PHONE=1 on the Mac
  mini; issue the iPhone Shortcut token in Settings → Inbox & email and build the Lookup Shortcut
  (docs/guides/iphone_phone_shortcut.md); supply 15–20 known numbers and run the test list, tuning
  points/thresholds in Settings → Phone lookup to reach ≥80% match (handoff §8.4, §8.9; Josh's
  check). Until CC_LIVE_PHONE=1 the stub stands in with deterministic data.
- Touch screen on the Mac mini (CC9 landed): set it to start in Chrome kiosk mode on the touch
  display beside the Mac mini (docs/guides/touch_kiosk.md — sign in once, start full screen at
  /touch, add it as a login item). Optionally change the idle-return time in Settings → Touch screen
  (default 3 minutes). Display only; the builds screen shows the GitHub stub until CC8's live wiring
  is on.

## Landings

- CC1, 2026-11-19. Merge 709b076 "[Merge] CC1 (foundation, logins, Mac mini updater)" into main.
  CI green: run 44449650659, both jobs (unit, e2e). Spec §4 checks 1-7 all pass — checks 1-3 by browser
  tests (9/9), checks 4-7 by unit tests (23/23). Branch was fast-forwardable onto main b2080a4; no
  migrations on production (handoff 7.5: the Mac mini updater applies them). Deploy and smoke after merge
  are the Mac mini updater's job (handoff 7.4). Waits on Josh: install Command Center on the Mac mini once
  (docs/install-mac.md), and the Cloudflare tunnel account step in that guide.
- CC2, 2026-11-19. Merge "[Merge] CC2 (kanban storage and board)" into main. CI green: run
  44455624341, both jobs (Lint/types/build/unit: success; Browser tests: success). Spec §4 checks all
  pass — handoff §11 "Kanban storage" checks 1-11 and spec §4 checks 1-4 (evidence in
  docs/sessions/CC2-status.md): unit 65/65, browser 18/18. Branch was fast-forwardable onto main
  dc32000; the only commits after the CI-green commit (a747852) are docs (chain.md + CC2-status.md),
  listed in the merge message. Migration 0002_kanban lands with the code; the Mac mini updater applies
  it (handoff 7.5) — expected objects: kanban_snapshots, app_settings, action_tokens, kanban_problems,
  card_seq. New waits on Josh: issue the Claude/Duet action-layer tokens in Settings when he wants
  Claude or Duet to edit cards over the tunnel (Duet stays off until he turns it on). The kanban folder
  path is set in Settings on the Mac mini (handoff §4.1: outside iCloud/Dropbox/OneDrive).
- CC3, 2026-11-19. Merge "[Merge] CC3 (home screen, calendars, weather, Refresh)" into main. CI
  green: run 44459153324, both jobs (Lint/types/build/unit: success; Browser tests: success). Spec
  §4 checks all pass — check 1 cc3-home-panels (josh+christine), check 2 cc3-today, check 3
  cc3-weather-zip + feeds unit, check 4 refresh-no-ai unit + cc3-refresh, check 5 cc3-board-kanban:
  unit 75/75, browser 24/24 (evidence in docs/sessions/CC3-status.md). Branch was fast-forwardable
  onto main 5e29bcf; the only commits after the CI-green commit (687cf5c) are docs (chain.md +
  CC3-status.md), listed in the merge message. Migration 0003_home lands with the code; the Mac
  mini updater applies it (handoff §7.5) — expected objects: calendar_feeds, calendar_events,
  weather_readings, feed_state, idx_calendar_events_feed. New waits on Josh: connect the three
  Google calendars and set the weather zip in Settings → Home feeds; decide on a standalone
  Calendar screen (CC3-ASK-1).
- CC4, 2026-11-19. Merge "[Merge] CC4 (note intake, Inbox, Awaiting reply, nudges)" into main. CI
  green: run 44462137720, both jobs (Lint/types/build/unit: success; Browser tests: success). Spec
  §4 checks pass — check 1 (no Gmail send; drafts only) by cc4-inbox-email unit + cc4-awaiting
  browser; check 2 (Shortcut token refused on every other route) by cc4-inbox-email unit +
  cc4-api-shortcut and permissions browser. Handoff §11 "Inbox and email" all pass (evidence in
  docs/sessions/CC4-status.md): unit 86/86, browser 38/38. Branch was fast-forwardable onto main
  (0 behind); the only commits after the CI-green commit (c971679) are docs (chain.md +
  CC4-status.md), listed in the merge message, via: git merge --no-ff cc4-inbox-email. Migration
  0004_inbox_email lands with the code; the Mac mini updater applies it (handoff §7.5) — expected
  objects: awaiting_dismissed, intake_seen. New waits on Josh: connect Gmail and set the intake
  address in Settings → Inbox & email, issue the iPhone Shortcut token, and build the note Shortcut
  from docs/guides/iphone_note_shortcut.md; answer CC4-ASK-1 (new intake address vs alias).
- CC5, 2026-11-19. Merge "[Merge] CC5 (deals, contacts, Projects grid)" into main. CI green: run
  44466065276, both jobs (Lint/types/build/unit: success; Browser tests: success). Spec §4 checks
  all pass — check 1 cc5-deals-contacts browser (each login reaches Deals and Contacts from the
  menu), check 2 cc5-deals-contacts browser + cc5-deals unit (Claude deal change with Revert
  restores earlier values), check 3 cc5-deals unit (a contact's second email matches an Awaiting
  thread to its deal; browser-unit-only, see CC5-status "Decided without asking"), check 4 cc5-deals
  unit (five seed deals after a fresh install), check 5 cc5-deals-contacts browser (board toggle
  filters deals by their boards list). Deal action-layer commands (update_deal, read_deal,
  revert_deal) covered by cc5-api-deal browser. unit 103/103, browser 46/46 (evidence in
  docs/sessions/CC5-status.md). Branch was fast-forwardable onto main (0 behind); the only commits
  after the CI-green commit (ac40d4f) are docs (chain.md + CC5-status.md), listed in the merge
  message, via: git merge --no-ff cc5-deals-contacts. Migration 0005_deals_contacts lands with the
  code; the Mac mini updater applies it (handoff §7.5) — expected objects: deals, deal_estimates,
  deal_changes, contacts, contact_emails, contact_deals, idx_deal_estimates_deal,
  idx_deal_changes_deal, idx_contact_emails_email, idx_contact_deals_deal. New waits on Josh: none
  (EZ Binder estimate status and GC jobs use stubs until CC6).
- CC6, 2026-11-19. Merge "[Merge] CC6 (EZ Binder connection, money, GC schedule)" into main. CI
  green: run 44469708327, both jobs (Lint/types/build/unit: success; Browser tests: success). All
  handoff §11 "EZ Binder and schedule" checks and spec §4 checks pass against the stub (evidence in
  docs/sessions/CC6-status.md): money tiles match GET /summary/ar to the cent (cc6-ezbinder unit +
  browser); a schedule change reaches Home by webhook (~10s) and by the 90-minute sync (cc6-ezbinder
  unit); Josh/rule/Claude moves each show as proposals with their source and change nothing in EZ
  Binder until confirmed (cc6-ezbinder unit + browser); no QuickBooks calls (static scan); spec
  check 1 bad-signature webhook refused and logged, check 2 a repeat event changes data once, check
  3 a rule proposal is not repeated once confirmed/rejected (cc6-ezbinder unit). Each login reaches
  Money and Schedule from the menu (cc6-ezbinder browser). unit 121/121, browser 50/50. Branch was
  fast-forwardable onto main (0 behind; merge-base = main tip 634d229); the only commits after the
  CI-green commit (089cac9) are docs (chain.md + CC6-status.md), listed in the merge message, via:
  git merge --no-ff cc6-ez-binder. Migration 0006_ez_binder lands with the code; the Mac mini
  updater applies it (handoff §7.5) — expected objects: ezb_money, ezb_jobs, ezb_tasks,
  ezb_proposals, ezb_events, ezb_sync, idx_ezb_tasks_job, idx_ezb_proposals_task. New waits on Josh:
  EZB-ASK-1 (confirm the S156 API accepts josh and rule proposals, ideally add the S156 contract to
  docs/specs/) before the live Mac-mini wiring of Josh/rule schedule proposals; set the EZ Binder
  API key, webhook signing secret, base URL (app setting ezb_base_url) and turn on ezb_live when
  S156 is live. Until then the stub stands in and CC6 shows no EZ Binder data on an unconnected Mac
  mini.
- CC7, 2026-11-19. Merge "[Merge] CC7 (Sync with Claude, Revert and usage)" into main. CI green:
  run 44472510340, both jobs (Lint/types/build/unit: success; Browser tests: success). Spec §4 and
  handoff §11 "AI usage" checks all pass against the Claude stub (evidence in
  docs/sessions/CC7-status.md): nothing calls Claude except the Sync button (cc7-sync unit static
  scan — only src/lib/sync imports the Claude client — and "engine starts no timer"; refresh-no-ai
  unit); unchecked items do not run and an item with nothing new is skipped without a Claude call
  (cc7-sync unit); Refresh makes no Claude call (refresh-no-ai unit); Revert restores a Claude change
  and is logged and Revert all undoes a whole run (spec check 1 — cc7-sync unit + browser); Claude
  cannot move to done/discarded, change boards or rewrite a body (cc7-sync unit + kanban-tokens
  browser); Duet off is refused (unchanged kanban-tokens/permissions); a run's usage line matches its
  own report (spec check 2 — cc7-sync unit). Each login reaches Sync from the top bar and the 30-day
  usage panel shows on the popup (cc7-sync browser, josh + christine). unit 139/139, browser 52/52.
  Branch was fast-forwardable onto main (0 behind; merge-base = main tip 09a9cc9); the only commits
  after the CI-green commit (cd6397e) are docs (chain.md + CC7-status.md), listed in the merge
  message, via: git merge --no-ff cc7-sync. Migration 0007_sync lands with the code; the Mac mini
  updater applies it (handoff §7.5) — expected objects: sync_runs, sync_run_items, sync_changes,
  idx_sync_run_items_at, idx_sync_changes_run. New waits on Josh: set CC_LIVE_AI=1 on the Mac mini to
  run Sync through the Claude Code command line (the stub stands in until then); optionally set app
  setting ai_weekly_plan_tokens for the Sync popup's weekly-plan % tile.
- CC8, 2026-11-19. Merge "[Merge] CC8 (Builds screen, build questions, build budget)" into main. CI
  green: run 44478042639, both jobs (Lint/types/build/unit: success; Browser tests: success). Spec §4
  = handoff §11 "Builds" checks (minus the touch-screen ones, which are CC9) all pass against the
  GitHub stub (evidence in docs/sessions/CC8-status.md): check 1 right stage from GitHub (cc8-builds
  unit state derivation + "Josh reaches Builds" browser); check 2 the bell count and red Builds badge
  update on a new unanswered question — the touch-screen jump is CC9 (cc8-builds unit alerts +
  browser nav-count-builds=1/bell-count=2 and the badge dropping to 0 after an answer); check 3 an
  answer appears in the status file verbatim with the time, chain.md changed in the same [skip ci]
  commit, then the card shows the runner command (cc8-builds unit "writes the answer verbatim" +
  browser "Josh answers a build question"); check 4 the app writes to GitHub only status files +
  chain.md on build branches and budget.json — enforced in github.commit() (DisallowedWriteError),
  not just asserted (cc8-builds unit write-allowlist); check 5 the budget tile matches this week's
  usage.jsonl, HOLD shows when the runner would hold, Override writes override_until and the next
  start proceeds (cc8-builds unit budget + browser "Override clears the build-budget hold"). Checks 6
  & 7 (Mac-mini live / rollback) are the §7.4 updater's mechanics, built and tested in CC1; CC8 only
  displays their state (cc8-builds unit updater display). Each login reaches Builds from the left
  menu / the top-bar bell and the Software builds settings card from the menu (cc8-builds browser,
  josh + christine). unit 163/163, browser 57/57. Branch was fast-forwardable onto main (0 behind;
  merge-base = main tip d241f21); the only commits after the CI-green commit (f7f827a) are docs
  (chain.md + CC8-status.md), listed in the merge message, via: git merge --no-ff cc8-builds.
  Migration 0008_builds lands with the code; the Mac mini updater applies it (handoff §7.5) —
  expected objects: builds_files, builds_commits, idx_builds_commits_repo. New waits on Josh: set the
  github_token in Settings → Keys (docs/guides/github_token.md) and CC_LIVE_GITHUB=1 on the Mac mini
  to read/write real GitHub (the stub stands in until then); create the private build-control repo
  and set the weekly build limit in Settings → Software builds.
- CC9, 2026-11-19. Merge "[Merge] CC9 (touch screen, swipe, idle return, build-alert jump)" into
  main. CI green: run 44482326329, both jobs (Lint/types/build/unit: success; Browser tests:
  success). Spec §4 checks all pass (evidence in docs/sessions/CC9-status.md): check 1 touch screen
  returns to screen 1 after the idle time and swipe works both ways (cc9-touch e2e idle + swipe;
  cc9-touch unit idle-setting default 3 / persists / clamps 1–60); check 2 a build entering Needs
  Josh, the hold starting and a failed update each jump to screen 2 with the banner (cc9-touch unit
  touchAlerts + decideInitialScreen + newAlertKeys for all three conditions; cc9-touch e2e opens on
  screen 2 with the banner naming EZ Binder + the hold and the red Needs-Josh row); check 3 the
  toggle switches screen 1's data and choosing Christine or Bishops on screen 2 jumps to screen 1
  (cc9-touch e2e). Each login reaches the touch screen from the left menu and the idle time is set
  in Settings → Touch screen (cc9-touch e2e, josh + christine). The touch screen is display only —
  no phone lookup (cc9-touch e2e). unit 182/182, browser 62/62. Branch was fast-forwardable onto
  main (0 behind; merge-base = main tip 57c9c7f); the CI-green commit df7b7ab added
  cc9-touch-screen to the CI branch list (.github/workflows/ci.yml), and the only commits after it
  are docs (chain.md + CC9-status.md), listed in the merge message, via: git merge --no-ff
  cc9-touch-screen. No new migration: CC9 is display-only and its one editable setting (the idle
  minutes, app_settings key touch_idle_minutes) reuses the app_settings table (migration 0002), so
  there are no new database objects for the Mac mini updater to apply. New waits on Josh: set the
  touch screen to start in Chrome kiosk mode on the Mac mini (docs/guides/touch_kiosk.md); optionally
  change the idle-return time in Settings → Touch screen.
- CC11, 2026-11-19. Merge "[Merge] CC11 (Mac install fixes, real Google sign-in, Josh's answers)"
  into main. CI green: run 44533714010, both jobs (Lint/types/build/unit: success; Browser tests:
  success). Spec §4 checks all pass against the stubs (evidence in docs/sessions/CC11-status.md):
  check 1 connect/refresh/disconnect each calendar, Gmail and the intake mailbox clicked from
  Settings as Josh and Christine (cc11-google e2e); check 2 an expired/revoked token raises a
  Problem with Reconnect that restores the feed (cc11 unit + cc11-google e2e Problems/Reconnect);
  check 3 the Today panel shows stub events on the live code path (cc11 unit); check 4 one pending
  note per intake message, no duplicate on a second poll (cc11 unit); check 5 Awaiting reply and
  nudge drafts on the live path with no send scope and no send call (cc11 unit + static scan);
  check 6 Josh and rule moves post X-EZB-Actor claude with the source note (cc11 unit); check 7 the
  installer dry run in a spaced path — quoted env that sources cleanly, PATH + log paths in both
  plists, tunnel job only with a config.yml (install-dryrun unit); check 8 the updater builds into
  staging and switches only after a successful build, failed build leaves the served version
  untouched (cc11 + updater unit). unit 235/235, browser 77/77. Branch was fast-forwardable onto
  main (0 behind; merge-base = main tip 0157472); the CI-green commit c3d0089 added
  cc11-mac-fixes-google to the CI branch list (.github/workflows/ci.yml), and the only commits
  after it are docs (chain.md + CC11-status.md), listed in the merge message, via:
  git merge --no-ff cc11-mac-fixes-google. Migration 0010_google_oauth lands with the code; the Mac
  mini updater applies it (handoff §7.5) — expected objects: google_oauth_pending, feed_problems.
  Answered this build: CC3-ASK-1 (no standalone Calendar screen now), CC4-ASK-1 (intake mailbox is
  evanmbishop23@gmail.com), EZB-ASK-1 (Claude can change the schedule; Josh/rule moves post as
  actor claude with a source note). New waits on Josh: create the Google Cloud project and OAuth
  client per docs/guides/google_connect.md, enter the client ID and secret in Settings → Keys, set
  CC_LIVE_FEEDS=1 in ~/.commandcenter/env (or the Library config dir), then connect the three
  calendars, Gmail and evanmbishop23@gmail.com in Settings; set up Cloudflare Access (one-time PIN,
  Cloudflare IdP off, Bypass apps for /api/notes, /api/phone/*, /api/ezbinder/webhook) per
  docs/install-mac.md; re-run the installer to add the tunnel-run launchd job.
- CC10, 2026-11-19. Merge "[Merge] CC10 (phone lookup, Twilio/FTC/FCC, marks, Shortcut)" into main.
  CI green: run 44486999240, both jobs (Lint/types/build/unit: success; Browser tests: success).
  Spec §4 = handoff §11 "Phone lookup" checks (minus Josh's 80% test-list check, which needs real
  keys) all pass against the stubs (evidence in docs/sessions/CC10-status.md): a verdict with
  reasons for any US number in any format, desktop and Shortcut (cc10-phone unit + e2e check 1 +
  cc10-api-phone); no Claude call and no Twilio call on a repeat within 30 days (cc10-phone unit
  twilioFetchCount + no-AI import scan); the FTC backfill stops and resumes without losing progress
  and the daily ingest prunes >12 months (cc10-phone unit resumable month-paged backfill + prune);
  an FCC timeout still returns a result marked "FCC data unavailable" (cc10-phone unit injected
  never/throwing fetcher); a spam/real mark overrides the verdict for both users and removing it
  restores scoring (cc10-phone unit + e2e check 5 — Josh marks, Christine sees "Marked spam by
  Josh"); lookup history older than 90 days is deleted (cc10-phone unit pruneHistory); the Shortcut
  token works only on the phone and note routes and stops once revoked (cc10-api-phone + permissions
  e2e + cc10-phone unit revoke; refusal elsewhere in cc4-api-shortcut + permissions). Each login
  reaches Phone lookup from the left menu; it is not tied to a board and the touch screen stays
  display-only (cc10-phone e2e josh + christine; cc9-touch unchanged). unit 212/212, browser 73/73.
  Branch was fast-forwardable onto main (0 behind; merge-base = main tip 104f72f); the CI-green
  commit 41c2001 added cc10-phone-lookup to the CI branch list (.github/workflows/ci.yml), and the
  only commits after it are docs (chain.md + CC10-status.md), listed in the merge message, via:
  git merge --no-ff cc10-phone-lookup. Migration 0009_phone_lookup lands with the code; the Mac mini
  updater applies it (handoff §7.5) — expected objects: ftc_counts, ftc_sync_state, twilio_cache,
  phone_lookups, phone_marks, idx_ftc_counts_phone, idx_phone_lookups_phone,
  idx_phone_lookups_created. New waits on Josh: set the three keys (Twilio SID + token, FTC
  api.data.gov key, FCC app token) and CC_LIVE_PHONE=1 on the Mac mini; issue the Shortcut token and
  build the Lookup Shortcut (docs/guides/iphone_phone_shortcut.md); run the 15–20 number test list
  and tune Settings → Phone lookup to ≥80% match. Until CC_LIVE_PHONE=1 the stub stands in.
