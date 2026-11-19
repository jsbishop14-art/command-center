# CC9 build spec: touch screen

## 0. Josh's words (verbatim)

- 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that session will
  create the repo and/or anything else needed and start the build"
- Requirements: handoff section 6. Layout: docs/mockup/Ambient.dc.html and AmbientBuilds.dc.html.

## 1. What Josh gets

- The touch screen beside the Mac mini runs Command Center full screen in dark glass with large text.
- Screen 1, Today: clock, date, weather, the Josh / Christine / Bishops toggle, three stats, Today, that board's
  kanban in progress, Waiting on and due this week, last refreshed and last synced.
- Screen 2, Builds: clock, usage bars (weekly plan, Fable weekly, build budget with HOLD, dashboard), one row per
  project with the Queued / Building / Needs Josh / Landed tracker, recent activity, the same toggle.
- Swipe between screens; back to screen 1 after 3 minutes without a touch (editable).
- When a build needs him, the budget hold starts, or an update fails, the screen jumps to screen 2 with a red banner
  naming it.
- A guide for setting the touch screen to start in kiosk mode.

## 2. Scope

Handoff 6. Swipe built for any number of screens.

## 3. Must stay true

- Display only, apart from the toggle and swipe. No phone lookup on the touch screen.

## 4. Checks

1. Touch screen returns to screen 1 after the idle time; swipe works both ways.
2. A build entering Needs Josh, the hold starting, and a failed update each jump to screen 2 with the banner.
3. The toggle switches screen 1's data; choosing Christine or Bishops on screen 2 jumps to screen 1.

## 5. Not in this build

Mobile layout.

## 6. Grant

None.
