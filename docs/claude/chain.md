# chain.md: Command Center build chain

## Build order

| # | Name | Branch | Spec | Handoff sections | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | CC1 | cc1-foundation | docs/specs/CC1-BUILD-SPEC.md | 1, 1.1, 1.3, 7.4, 7.5 | Queued |
| 2 | CC2 | cc2-kanban | docs/specs/CC2-BUILD-SPEC.md | 3.1, 3.2, 4, 5.4 | Queued |
| 3 | CC3 | cc3-home | docs/specs/CC3-BUILD-SPEC.md | 2 (top bar, panels), 5.2, 7.3 | Queued |
| 4 | CC4 | cc4-inbox-email | docs/specs/CC4-BUILD-SPEC.md | 2 (Inbox, Awaiting reply), 2.1, 4.4 | Queued |
| 5 | CC5 | cc5-deals-contacts | docs/specs/CC5-BUILD-SPEC.md | 2 (Projects), 3.3, 3.4, 4.8 | Queued |
| 6 | CC6 | cc6-ez-binder | docs/specs/CC6-BUILD-SPEC.md | 2 (money, schedule), 2.2, 7.2, 7.3 | Queued |
| 7 | CC7 | cc7-sync | docs/specs/CC7-BUILD-SPEC.md | 5 | Queued |
| 8 | CC8 | cc8-builds | docs/specs/CC8-BUILD-SPEC.md | 7.1 | Queued |
| 9 | CC9 | cc9-touch-screen | docs/specs/CC9-BUILD-SPEC.md | 6 | Queued |
| 10 | CC10 | cc10-phone-lookup | docs/specs/CC10-BUILD-SPEC.md | 8 | Queued |

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

## What waits on Josh

- Switching command-center and build-control to private when the build is complete.
- Weekly build budget limit (tokens), after the first week of real usage. Until set, usage is recorded with no hold.
- Tunnel account for remote access (CC1 guide says which and how).
- Installing Command Center on the Mac mini once, after CC1 lands (one command from CC1's guide).
- Connecting Google (calendars, Gmail) after CC3 and CC4 land.
- Intake email address for notes (CC4).
- EZ Binder: confirming S156 is live, and the API key (CC6).
- A GitHub token for the Builds screen (CC8).
- Twilio, api.data.gov and FCC keys, plus 15 to 20 known numbers (before CC10 goes live).

## Landings

(none yet)
