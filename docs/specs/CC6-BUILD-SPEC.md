# CC6 build spec: EZ Binder connection, money and the GC schedule

## 0. Josh's words (verbatim)

- 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that session will
  create the repo and/or anything else needed and start the build"
- Requirements: handoff 2 (money tiles, GC jobs in Projects, GC schedule), 2.2, 7.2, 7.3. The EZ Binder contract
  ("EZ Binder API for Command Center: handoff", S156) governs every call. Layout: docs/mockup/Main.dc.html.

## 1. What Josh gets

- Money tiles (open A/R, received this week, open invoices, over 30 days) from EZ Binder, to the cent.
- GC job cards in Projects with phase, Now, Next and Money; deal cards show linked estimates' status and totals.
- The GC schedule for the next 2 weeks, one row per active or sold-not-started job.
- He can drag a job's or task's dates; the move goes to EZ Binder as a proposal. The slip rule proposes shifting later
  tasks when a task runs past its end. Each proposal shows its source and changes nothing until he confirms in EZ
  Binder.
- Changes arrive by webhook within about 10 seconds, with a 90-minute background sync as the safety net.

## 2. Scope

Handoff 2, 2.2 (Josh and slip-rule proposals; Claude proposals come in CC7), 7.2, 7.3 EZ Binder row. Webhook receiver
through the tunnel with signature checks. Everything against a stub built from the S156 contract until Josh confirms
S156 is live.

## 3. Must stay true

- X-EZB-Actor on every call. The EZ Binder key never leaves the secret store; Claude never holds it.
- Any date move other than one Josh confirms in EZ Binder is a proposal.
- No QuickBooks. No editing EZ Binder money records.
- Each webhook event processed once; newest updated_at wins.

## 4. Checks

All checks under "EZ Binder and schedule" in handoff section 11, against the stub, plus:
1. A webhook with a bad signature is refused and logged.
2. The same event delivered twice changes data once.
3. A rule proposal is not repeated for a task once confirmed or rejected.

## 5. First step and question

Before building proposals, read the S156 contract: does the API accept proposals with X-EZB-Actor josh and rule? If
not, or if the contract is not in docs/specs/, write the question for Josh in the status file and build everything
else first.

## 6. Grant

None. No calls to the real EZ Binder from CI or build sessions.
