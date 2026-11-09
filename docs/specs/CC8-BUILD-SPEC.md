# CC8 build spec: Builds screen, build questions and the build budget

## 0. Josh's words (verbatim)

- 2026-11-09 15:14: "The Budget tile is the build budget from your PROCESS.md. You set a limit; when the builds reach
  it, you get a notification and the hold starts. During the hold, no new tickets start, in-progress work finishes,
  and you can override it. The tile shows how close the builds are to that limit and whether the hold is on. It
  covers the builds only, not the dashboard's Sync usage."
- 2026-11-09 15:19, answers: "1. a 2. a 3. a 4. a 5. a 6. a" (see chain.md for each meaning).
- Requirements: handoff 7.1. Layout: docs/mockup/Builds.dc.html.

## 1. What Josh gets

- A Builds screen showing every tracked project from GitHub: current build, Queued / Building / Needs Josh / Landed,
  place in the chain, PICK UP HERE line, last activity, last landing, and "Live on Mac mini" for Command Center.
- Build questions answered in place, one at a time, with the options and the recommendation. His answer is written
  into the build's status file on GitHub with chain.md in the same commit. Then the card shows the runner command to
  copy.
- The build budget tile: this week's build usage against his limit, HOLD when it applies, Override with an end time,
  limit and warning percentage in Settings.
- Alerts: bell count, red Builds badge, warning at the budget warning level, and the hold.
- A guide for creating the GitHub token Command Center uses.

## 2. Scope

Handoff 7.1 in full, the 7.3 GitHub rows, the alert data the touch screen uses in CC9.

## 3. Must stay true

- The app writes to GitHub only status files and chain.md on build branches, and budget.json in build-control.
- The app never starts or restarts the runner, and has no Approve and merge.
- Answers are verbatim, with the time, in process.md's format.

## 4. Checks

All checks under "Builds" in handoff section 11 that don't need the touch screen, against a GitHub stub.

## 5. Not in this build

The touch screen (CC9). The runner's budget change itself (already in docs/process.md section 12).

## 6. Grant

None. No real GitHub writes from CI.
