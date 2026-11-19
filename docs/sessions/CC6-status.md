# CC6 status: EZ Binder connection, money and the GC schedule

Branch: cc6-ez-binder. Spec: docs/specs/CC6-BUILD-SPEC.md. Handoff sections: 2 (money, schedule),
2.2, 7.2, 7.3. One fresh session per build; this file is the only memory between sessions.

## RESUME (spec §0 and the run prompt, verbatim)

Spec §0 (Josh's words, verbatim):

- 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that
  session will create the repo and/or anything else needed and start the build"
- Requirements: handoff 2 (money tiles, GC jobs in Projects, GC schedule), 2.2, 7.2, 7.3. The EZ
  Binder contract ("EZ Binder API for Command Center: handoff", S156) governs every call. Layout:
  docs/mockup/Main.dc.html.

Run prompt (verbatim):

> Unattended run in a FRESH session, started by scripts/run_chain.py. Your job is ONLY build CC6.
> 1. Read CLAUDE.md, docs/claude/chain.md and the handoff sections your spec names. If
>    docs/specs/CC6-BUILD-SPEC.md is not on main, bring it from origin/docs/next-builds with your
>    first commit.
> 2. git fetch origin. If origin/cc6-ez-binder exists: check it out, report git status (never
>    discard uncommitted work), read docs/sessions/CC6-status.md and continue from PICK UP HERE.
>    Otherwise create cc6-ez-binder from origin/main and the status file with a RESUME block quoting
>    the spec's section 0 and this prompt verbatim.
> 3. Build docs/specs/CC6-BUILD-SPEC.md per docs/process.md section 4 (decide and log; hard stops
>    only). Commit and push the feature branch after every step. ONE deliberate CI run. Keep a tool
>    call printing output at least every 20 minutes.
> 4. No production grant. Production is Josh's Mac mini, which build sessions never touch (handoff
>    section 7.5). Migrations land with the code and the Mac mini updater applies them. No real
>    outside calls: use the stubs. No real email, ever.
> 5. Land per the landing rule as adapted in CLAUDE.md (handoff section 7.5). The merge commit
>    message MUST start with "[Merge] CC6 (". The Mac mini updater deploys and smoke-checks after
>    the merge (handoff section 7.4). Record the landing in chain.md and the status file.
> 6. Then STOP. Do not start the next build. If a hard stop or a question for Josh blocks landing,
>    write it in the status file's Questions section (plain text, full question, options,
>    recommendation), push, and end. If the status file already holds questions with NO recorded
>    answer, change nothing and end at once, saying so: Josh answers through the chat session or the
>    Command Center dashboard, which record the answers in the status file.

## PICK UP HERE

LANDED. Nothing left for this build. CC7 is a separate session.

## Landing

Landed 2026-11-19. Merge message starts "[Merge] CC6 (EZ Binder connection, money, GC schedule)".
CI green: run 44469708327 on cc6-ez-binder, both jobs (Lint/types/build/unit: success; Browser
tests: success) on the CI-green commit 089cac9. All checks above pass against the stub (unit
121/121, browser 50/50). Branch was fast-forwardable onto main (0 behind; merge-base = main tip
634d229); the only commits after 089cac9 are docs (chain.md + CC6-status.md), listed in the merge
message, via: git merge --no-ff cc6-ez-binder. Migration 0006_ez_binder lands with the code; the Mac
mini updater applies it (handoff §7.4/§7.5) — expected objects: ezb_money, ezb_jobs, ezb_tasks,
ezb_proposals, ezb_events, ezb_sync, idx_ezb_tasks_job, idx_ezb_proposals_task. Deploy and smoke
after merge are the Mac mini updater's job (handoff §7.4), not this session's.

EZB-ASK-1 is tabled for Josh (live Mac-mini wiring of josh/rule proposals). It did NOT block the
landing: the whole flow is built and tested against the stub per spec §5 ("build everything else
first"). It is recorded in chain.md "What waits on Josh".

## Plan

1. Branch, spec, status file (this commit).
2. Migration 0006_ez_binder (money, jobs, tasks, proposals, events, sync tables) + generated types.
3. EZ Binder client + stub (built from the S156 contract description in the handoff) + cache store +
   stub/live gating. X-EZB-Actor on every call; key only from the secret store.
4. Sync (/summary/ar, jobs, /schedule, /changes cursor) + slip-rule proposals + money/schedule views.
5. Webhook receiver with signature check, idempotency (each event once), newest updated_at wins.
6. Josh drag proposals + proposals route; resolve (confirm/reject) markers.
7. UI: money tiles from cache, GC schedule grid, Schedule screen, Money screen, nav wiring, CSS.
8. Wire the CC5 estimate/GC-job/active-client stubs through the one client; sync on Refresh and in
   seed/global-setup.
9. Tests: unit (ezbinder) + browser (each login reaches Money and Schedule from the menu).
10. One deliberate CI run.
11. Land per handoff §7.5; record in chain.md and here.

## Decided without asking

1. The schedule move is an accessible date form ("Propose a move": pick a task, set new start/end),
   not a pixel drag. Same result — a proposal sent under X-EZB-Actor josh; test-stable and keyboard
   usable. Changes no ruling, widens no access, writes no real data, undoable.
2. The Money screen and the GC schedule grid are not board-scoped: Christine sees everything
   (handoff §1.1) and billed/paid + A/R are financial data, not a board-filtered view like Projects.
3. EZ Binder jobs, money and the schedule now come through the one client + the ezb_* cache. The CC5
   estimate read (estimates.ts) and active-client read (clients.ts) keep their existing synchronous
   stubs with identical values; they move to the async client at S156 go-live. Avoids a sync→async
   ripple through buildProjects/DealPanel and keeps CC4/CC5 tests unchanged.
4. The 90-minute safety-net sync is a non-AI singleton interval (startEzbSync), the same pattern the
   CC2 kanban reconciler already uses. CLAUDE §8 "No timers" is read as "no timers that call Claude"
   (its sentence is about Claude calls, and the landed reconciler polls every 500ms); this sync is
   ordinary code explicitly required by spec §1 / handoff §7.3. It only arms where a sync is due
   (ezbShouldSync): in CI/dev/build against the stub, and in production once EZ Binder is connected;
   never on an unconnected Mac mini, so no stub data appears there (mirrors calendars/Gmail).

## Checks (spec §4, handoff §11 "EZ Binder and schedule") — all pass against the stub

- [x] Money tiles match EZ Binder GET /summary/ar to the cent — cc6-ezbinder unit (cached cents equal
      the stub; tiles format "$243,187.42"/"$98,650.10"/"7" without rounding) + cc6-ezbinder browser
      (Home and Money show the values for both logins).
- [x] A schedule change reaches Home within ~10s (webhook); with webhooks blocked, within 90 min
      (sync) — cc6-ezbinder unit: a task.updated webhook updates the cache and the grid at once; the
      90-minute ezbSync fills the cache and records last_sync. The poll is a non-AI interval (decided
      without asking 4).
- [x] Proposals from Josh, the slip rule and Claude each show as proposals with their source and
      change nothing in EZ Binder until Josh confirms — cc6-ezbinder unit (josh/rule/claude all show
      as 'proposed' with their source; a Josh move leaves the cached task dates untouched) +
      cc6-ezbinder browser (Josh proposes a move → "Proposed by Josh"; the slip rule shows "Proposed
      by rule"; reject clears it).
- [x] No QuickBooks calls anywhere — cc6-ezbinder unit static scan (no ezbinder source references
      quickbooks/intuit/qbo or the Anthropic SDK). The app imports no QuickBooks client.
- [x] spec check 1: a webhook with a bad signature is refused and logged — cc6-ezbinder unit: the
      route returns 401 and records outcome 'bad_signature'.
- [x] spec check 2: the same event delivered twice changes data once — cc6-ezbinder unit: a second
      delivery of the same id is a duplicate and does not apply its (tampered) data.
- [x] spec check 3: a rule proposal is not repeated for a task once confirmed or rejected —
      cc6-ezbinder unit: re-running the slip rule after confirm/reject creates nothing for that task.

Tallies (local): unit 121/121, browser 50/50.

## Questions

See EZB-ASK-1 below (tabled per spec §5; does not block the build — everything else is built first
against the stub).

ANSWERED 2026-11-19 (CC11): Josh — "2. i think claude can change the schedule" and "2a- yes if it
is already built into the system." Chosen: B. Josh and slip-rule schedule-move proposals go to EZ
Binder with X-EZB-Actor `claude` and a note naming the real source ("moved by Josh" / "moved by
rule: <rule name>"); they stay proposals until Josh confirms them in EZ Binder. Built in CC11.

Qn. [EZB-ASK-1] The S156 contract ("EZ Binder API for Command Center: handoff") is not in
docs/specs/, so I cannot confirm from it whether the real EZ Binder API accepts schedule-move
proposals sent with X-EZB-Actor values `josh` and `rule` (handoff §2.2 notes v2 accepted only
Claude moves as 202 proposals). CC6 builds the whole proposal flow against the stub, which accepts
`josh` and `rule` and returns 202. Going live against the real EZ Binder for Josh and rule proposals
waits on this answer. What should happen?
Options:
  A) Confirm the S156 API accepts `josh` and `rule` proposals (ideally add the S156 contract to
     docs/specs/); the live path then needs no change.
  B) It accepts only Claude proposals; Josh and rule moves should post with X-EZB-Actor `claude`
     (tagged with the real source in the proposal note) when live.
  C) It accepts only Claude proposals and Josh/rule moves must not go to EZ Binder at all; show them
     as local-only proposals until EZ Binder adds support.
My recommendation: A — the stub is built to the handoff's description and the flow is ready; adding
the S156 contract to docs/specs/ lets a later session verify the live path without guessing. This
blocks only the real Mac-mini wiring, not the CC6 landing (built and tested against the stub).
