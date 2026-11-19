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

Step 1 done: branch cc6-ez-binder created from origin/main; spec brought from origin/docs/next-builds;
pre-push hook installed. Building the EZ Binder connection against the stub.

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

(none yet)

## Checks (spec §4, handoff §11 "EZ Binder and schedule")

- [ ] Money tiles match EZ Binder GET /summary/ar to the cent.
- [ ] A schedule change reaches Home within ~10s (webhook); with webhooks blocked, within 90 min (sync).
- [ ] Proposals from Josh, the slip rule and Claude each show as proposals with their source and
      change nothing in EZ Binder until Josh confirms.
- [ ] No QuickBooks calls anywhere.
- [ ] spec check 1: a webhook with a bad signature is refused and logged.
- [ ] spec check 2: the same event delivered twice changes data once.
- [ ] spec check 3: a rule proposal is not repeated for a task once confirmed or rejected.

## Questions

See EZB-ASK-1 below (tabled per spec §5; does not block the build — everything else is built first
against the stub).

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
