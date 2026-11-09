# CC3 build spec: Home screen, calendars, weather and Refresh

## 0. Josh's words (verbatim)

- 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that session will
  create the repo and/or anything else needed and start the build"
- Requirements: handoff section 2 (top bar, Today and Kanban panels), 5.2, 7.3. Layout: docs/mockup/Main.dc.html.

## 1. What Josh gets

- The Home screen from the mockup: top bar with date, weather (saved zip 33472, editable), search, Refresh, the Sync
  button placeholder (works in CC7), bell, Quick add and board toggle.
- Four panels with drag handles and collapse arrows, saved per user. Today shows events from three Google calendars
  (Christine personal, Josh work, Josh personal), colored by person, plus kanban cards due today. Kanban in progress
  shows the current board's in-progress cards with a link to the board. Inbox and Awaiting reply panels show
  "Coming in CC4".
- Money tiles and the GC schedule show "Waiting on EZ Binder" until CC6.
- A Settings page to connect each Google calendar. Josh connects them after this lands.
- Refresh pulls calendars and weather on demand, with no AI. Live feed status list in the left menu.

## 2. Scope

Handoff 2 (top bar, Today, Kanban in progress), 5.2, 7.3 rows for calendars and weather. Weather from a free source
with no paid key.

## 3. Must stay true

- No AI. No location services. Calendar tokens in the secret store.
- The board toggle switches every panel on Home.

## 4. Checks

1. Browser test as each login: Home loads; panels reorder and collapse and stay that way after a restart.
2. With stubbed calendars, events from all three appear in the right colors, plus a due card.
3. Changing the zip in Settings changes the weather source request (stubbed).
4. Refresh makes no Claude call (asserted).
5. Board toggle changes the Kanban panel's cards.

## 5. Not in this build

Inbox, Awaiting reply (CC4), Projects grid and deals (CC5), EZ Binder data (CC6), Sync (CC7).

## 6. Grant

None.
