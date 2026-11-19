# CC7 build spec: Sync with Claude, Revert and usage

## 0. Josh's words (verbatim)

- 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that session will
  create the repo and/or anything else needed and start the build"
- Requirements: handoff section 5 (all), 2.2 (Claude proposals), 4.8. Layout: docs/mockup/SyncDialog.dc.html,
  SyncResults.dc.html, Builds.dc.html (dashboard usage panel).

## 1. What Josh gets

- The Sync with Claude button opens a popup with three items, all checked: Sort Inbox notes, Kanban updates, Schedule
  proposals. He can uncheck any. An item with nothing new is skipped without using Claude.
- After the run, a results list shows every change with Revert (Withdraw for schedule proposals) and Revert all.
- Usage per run: last Sync tokens, dashboard tokens this week, weekly plan share, and a 30-day chart split by item.
- Claude in a chat can change cards, notes, deals and schedule proposals through the action layer, logged with a
  chat- run id and revertible.
- Duet connects through the action layer behind its on/off switch.

## 2. Scope

Handoff 5, 5.1 to 5.6. Sync calls Claude on the Mac mini through the Claude Code command line, signed in to Josh's
plan, with no API key (the same way the build runner does). Model per item: the smallest that does the job well.

## 3. Must stay true

- Nothing calls Claude except the Sync button (and chat and Duet, which run outside the app). No timers.
- Claude kanban changes respect handoff 4.7 rule 8.
- After every Sync, the kanban folder is committed to git.

## 4. Checks

All checks under "AI usage" in handoff section 11, plus:
1. Revert all undoes every change from one run, and is logged.
2. A Sync run's usage line matches the run's own usage report.

## 5. Not in this build

Scheduled syncs and Rewrite with Claude (removed in v3).

## 6. Grant

None. In CI, Claude is stubbed.
