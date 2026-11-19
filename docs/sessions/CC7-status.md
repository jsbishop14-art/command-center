# CC7 status: Sync with Claude, Revert and usage

Branch: cc7-sync (from origin/main). Spec: docs/specs/CC7-BUILD-SPEC.md. Handoff: §5 (all), §2.2, §4.8, §4.7 rule 8.

## RESUME block

Spec §0 (verbatim):

> - 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that session will
>   create the repo and/or anything else needed and start the build"
> - Requirements: handoff section 5 (all), 2.2 (Claude proposals), 4.8. Layout: docs/mockup/SyncDialog.dc.html,
>   SyncResults.dc.html, Builds.dc.html (dashboard usage panel).

Prompt (verbatim):

> Unattended run in a FRESH session, started by scripts/run_chain.py. Your job is ONLY build CC7.
> 1. Read CLAUDE.md, docs/claude/chain.md and the handoff sections your spec names. If docs/specs/CC7-BUILD-SPEC.md is not on main, bring it
>    from origin/docs/next-builds with your first commit.
> 2. git fetch origin. If origin/cc7-sync exists: check it out, report git status (never discard uncommitted work), read
>    docs/sessions/CC7-status.md and continue from PICK UP HERE. Otherwise create cc7-sync from origin/main and the
>    status file with a RESUME block quoting the spec's section 0 and this prompt verbatim.
> 3. Build docs/specs/CC7-BUILD-SPEC.md per docs/process.md section 4 (decide and log; hard stops only). Commit and push the feature branch
>    after every step. ONE deliberate CI run. Keep a tool call printing output at least every 20 minutes.
> 4. No production grant. Production is Josh's Mac mini, which build sessions never touch (handoff section 7.5). Migrations land with the code and the Mac mini updater applies them. No real outside calls: use the stubs. No real email, ever.
> 5. Land per the landing rule as adapted in CLAUDE.md (handoff section 7.5). The merge commit message MUST start with
>    "[Merge] CC7 (". The Mac mini updater deploys and smoke-checks after the merge (handoff section 7.4). Record the
>    landing in chain.md and the status file.
> 6. Then STOP. Do not start the next build. If a hard stop or a question for Josh blocks landing, write it in the status
>    file's Questions section (plain text, full question, options, recommendation), push, and end. If the status file
>    already holds questions with NO recorded answer, change nothing and end at once, saying so: Josh answers through the
>    chat session or the Command Center dashboard, which record the answers in the status file.

## PICK UP HERE

LANDED. CC7 merged into main — "[Merge] CC7 (Sync with Claude, Revert and usage)". CI green: run 44472510340, both jobs (Lint/types/build/unit: success; Browser tests: success). unit 139/139, browser 52/52. Branch fast-forwardable onto main (0 behind; merge-base = main tip 09a9cc9); only docs/ changed after the CI-green commit cd6397e (chain.md + this file), via git merge --no-ff cc7-sync. Migration 0007_sync lands with the code; the Mac mini updater applies it — expected objects: sync_runs, sync_run_items, sync_changes, idx_sync_run_items_at, idx_sync_changes_run. Waits on Josh: set CC_LIVE_AI=1 on the Mac mini to run Sync through the Claude Code command line (the stub stands in until then); optionally set app setting ai_weekly_plan_tokens for the weekly-plan % tile. The Mac mini updater deploys and smoke-checks after the merge (handoff §7.4).

Earlier: branch cc7-sync created from origin/main; CC7 spec brought from origin/docs/next-builds; hooks path set. Built per the plan below.

## Plan (steps, each its own commit, [skip ci] except the one CI run)

1. Status file + spec (this commit).
2. Migration 0007_sync (sync_runs, sync_run_items, sync_changes); db-types if generated.
3. Claude client + mode (src/lib/sync/claude.ts, mode.ts): stub default everywhere (CI/build/dev), live only on the Mac mini via the Claude Code CLI (never exercised in tests). Model per item, smallest that does the job.
4. Sync engine (src/lib/sync/engine.ts): per-item "anything new" in ordinary code (skip without calling Claude), apply decisions via the action layer / proposals, record changes + usage, git-commit the kanban folder after the run.
5. Revert / Withdraw / Revert all (src/lib/sync/revert.ts).
6. Usage read model (src/lib/sync/usage.ts): last sync tokens, dashboard tokens this week, weekly plan %, 30-day chart split by item.
7. UI: SyncButton + SyncDialog + SyncResults + 30-day usage panel (replace the TopBar placeholder); server actions.
8. Unit tests (cc7-sync.test.ts) + e2e (cc7-sync.e2e.ts). Invert the sync-placeholder assumption.
9. One deliberate CI run; record check evidence.
10. Land onto main; record in chain.md + this file.

## Decided without asking

- Claude is stubbed everywhere except the Mac mini (spec §6 grant; CLAUDE §3). Mode gate CC_LIVE_AI=1 mirrors CC_LIVE_FEEDS; stub is deterministic and reports a token count so usage is testable. The engine decides "anything new" in ordinary code before any Claude call, so an item with nothing new is skipped without tokens (handoff §5.1).
- Model per item (§5.6 "smallest that does the job well"): Sort Inbox notes = claude-haiku-4-5; Kanban updates = claude-sonnet-5; Schedule proposals = claude-haiku-4-5. Recorded per item for the 30-day chart. (Changeable; widens no access, writes no real data.)
- Kanban updates source (stub): add a card for each EZ Binder job that has no card yet (source_ref = job id, deduped by handoff §4.7 rule 7); "nothing new" when every job already has a card. Within §4.7 rule 8 (actor claude → never done/discarded, never boards, append-only body).
- Schedule proposals source (stub): one Claude proposal per active job that has no open Claude proposal, shifting that job's next upcoming incomplete task; "nothing new" when each active job already has an open Claude proposal. Separate from the slip rule (which is ordinary code), so the two sources do not collide.
- 30-day usage panel lives inside the Sync dialog in CC7 (the Builds screen is CC8 and touch screen 2 is CC9; §5.5 lists all three). Reached by clicking the top-bar Sync button, so it gets a browser test without a direct URL.
- "Dashboard tokens this week" = rolling 7-day sum of Sync run tokens (deterministic for tests). Weekly plan % is an estimate against app_setting ai_weekly_plan_tokens; unset shows "—" (Max plan has no hard cap, §5.6). Josh can set the figure later (see Questions — not a blocker).
- Single Revert follows §5.4 (asks when the card/deal changed again); Revert all forces, undoing the whole run in reverse order and logging each.

## Checks (spec §4 + handoff §11 "AI usage")

Evidence local: unit 139/139, browser 52/52 (CC7 adds unit 18, browser 2). CI run recorded at landing.

Handoff §11 "AI usage":
1. Nothing calls Claude except the Sync button — cc7-sync unit static scan "only the sync module references the Claude client" (no file outside src/lib/sync imports claude.ts); "the Sync engine starts no timer" (no setInterval/setTimeout/cron in engine.ts); refresh-no-ai unit still green (Refresh imports no Claude client).
2. Unchecked Sync items do not run; an item with nothing new is skipped without a Claude call — cc7-sync unit "an unchecked item does not run" and "an item with nothing new is skipped without a Claude usage row" (skipped item gets no sync_run_items row, totalTokens 0; the engine decides emptiness in ordinary code before any client call).
3. Refresh makes no Claude call — refresh-no-ai unit (unchanged; runRefresh imports no Claude/sync client).
4. Revert restores a Claude/Duet change and is logged; Revert all undoes a whole Sync run — cc7-sync unit "Revert all undoes every change from a run and is logged" (spec check 1: every change reverted_at set; kanban cards discarded, schedule proposals rejected, inbox suggestions cleared; a josh-actor log line exists), "a single Revert of a schedule proposal withdraws it", "reverting a Sync kanban add discards the card as the reverter"; cc7-sync browser (Josh reverts one change then Revert all; Christine Revert all withdraws proposals).
5. Claude and Duet cannot move a card to Done/discarded, change boards or rewrite a body unless Josh asks in a chat — cc7-sync unit "Kanban adds respect the Claude limits" (added cards never done/discarded; actor claude); existing kanban-tokens browser + permissions unit still green (enforceLimits unchanged).
6. With the Duet switch off, Duet's token is refused — existing kanban-tokens/cc5-api-deal browser + permissions unit (unchanged by CC7).

Spec §4:
1. Revert all undoes every change from one run, and is logged — cc7-sync unit (above) + browser.
2. A Sync run's usage line matches the run's own usage report — cc7-sync unit "a run's usage line equals the sum of its per-item usage" (run.totalTokens == Σ sync_run_items.tokens == getRun().totalTokens) and "the dashboard-this-week and last-run tiles reflect the run".

Each login reaches Sync from the top bar (no direct URL) — cc7-sync browser (josh + christine open the dialog by clicking the top-bar button). The 30-day usage panel shows on the popup — cc7-sync browser (sync-usage-chart visible for both logins).

## Questions
(none blocking landing)
