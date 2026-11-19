# CC8 status — Builds screen, build questions, build budget

One fresh session per build; this file is the only memory between sessions (CLAUDE §2).

## RESUME

Spec section 0 (verbatim, docs/specs/CC8-BUILD-SPEC.md):

> ## 0. Josh's words (verbatim)
>
> - 2026-11-09 15:14: "The Budget tile is the build budget from your PROCESS.md. You set a limit; when the builds reach
>   it, you get a notification and the hold starts. During the hold, no new tickets start, in-progress work finishes,
>   and you can override it. The tile shows how close the builds are to that limit and whether the hold is on. It
>   covers the builds only, not the dashboard's Sync usage."
> - 2026-11-09 15:19, answers: "1. a 2. a 3. a 4. a 5. a 6. a" (see chain.md for each meaning).
> - Requirements: handoff 7.1. Layout: docs/mockup/Builds.dc.html.

This session's prompt (verbatim):

> Unattended run in a FRESH session, started by scripts/run_chain.py. Your job is ONLY build CC8.
> 1. Read CLAUDE.md, docs/claude/chain.md and the handoff sections your spec names. If docs/specs/CC8-BUILD-SPEC.md is not on main, bring it
>    from origin/docs/next-builds with your first commit.
> 2. git fetch origin. If origin/cc8-builds exists: check it out, report git status (never discard uncommitted work), read
>    docs/sessions/CC8-status.md and continue from PICK UP HERE. Otherwise create cc8-builds from origin/main and the
>    status file with a RESUME block quoting the spec's section 0 and this prompt verbatim.
> 3. Build docs/specs/CC8-BUILD-SPEC.md per docs/process.md section 4 (decide and log; hard stops only). Commit and push the feature branch
>    after every step. ONE deliberate CI run. Keep a tool call printing output at least every 20 minutes.
> 4. No production grant. Production is Josh's Mac mini, which build sessions never touch (handoff section 7.5). Migrations land with the code and the Mac mini updater applies them. No real outside calls: use the stubs. No real email, ever.
> 5. Land per the landing rule as adapted in CLAUDE.md (handoff section 7.5). The merge commit message MUST start with
>    "[Merge] CC8 (". The Mac mini updater deploys and smoke-checks after the merge (handoff section 7.4). Record the
>    landing in chain.md and the status file.
> 6. Then STOP. Do not start the next build. If a hard stop or a question for Josh blocks landing, write it in the status
>    file's Questions section (plain text, full question, options, recommendation), push, and end. If the status file
>    already holds questions with NO recorded answer, change nothing and end at once, saying so: Josh answers through the
>    chat session or the Command Center dashboard, which record the answers in the status file.

cc8-builds did not exist on origin at session start; created from origin/main. The CC8 spec was not on
main; brought from origin/docs/next-builds in the first commit.

## PICK UP HERE

BUILT, pending the deliberate CI run and landing. All code, tests and docs are in; local checks are
green (lint, typecheck, generated types in sync, unit 163/163, browser 57/57). Next in this session:
one deliberate CI run (ALLOW_CI=1) on cc8-builds, then land onto main per the landing rule with a
"[Merge] CC8 (" message, then record the landing here and in chain.md.

Done:
- lib/builds/: mode, types, github (stub + facade + write allowlist), stub (fixture), projects,
  budget, state (parse + derive), writer (commitAnswer/commitBudget), updater (reads §7.4 files),
  view. Migration 0008_builds (builds_files, builds_commits, idx_builds_commits_repo).
- Screen /builds + server actions (submitAnswerAction, overrideBudgetAction); QuestionPanel,
  OverrideButton, CopyCommand. Settings → Software builds (BuildsSettingsPanel) + settings actions.
  Nav "Builds" and the top-bar bell are real links with the red badge / bell count. CI branch
  trigger added. Guide docs/guides/github_token.md.
- Tests: tests/unit/cc8-builds.test.ts (24), tests/e2e/cc8-builds.e2e.ts (5).

## Plan (decided; from spec, handoff §7.1, §7.3 GitHub rows, mockup Builds.dc.html)

The Builds screen reads everything from GitHub (stubbed, like every other outside source — handoff
§7.5, spec §6: no real GitHub writes/reads from CI). It writes to GitHub only three things: status
files and chain.md on build branches (answers), and budget.json in build-control (spec §3). It never
starts the runner and has no "Approve and merge" (spec §3).

GitHub is stubbed exactly as EZ Binder / Claude are: `CC_LIVE_GITHUB=1` on the Mac mini uses the real
GitHub API with the token in the secret store (`github_token`, already a CC1 secret); the default
everywhere (CI, build sessions, local) is the stub, whose state lives in the local database so the UI
reflects writes across requests and tests can verify them. The live path is never exercised by tests.

Modules (src/lib/builds/):
- mode.ts — liveGitHub() (mirror of sync/mode.ts, feeds/mode.ts).
- types.ts — Project, BuildStage, BuildCard, Question, BudgetState, Alert, etc.
- projects.ts — tracked projects (default 6: Command Center, EZ Binder API, Blueprint Creator, EZ
  Draft, FrameFocus, Popcorn Pilot), editable in Settings; stored in app_settings `builds_projects`.
- stub.ts — the fixture snapshot of each repo's GitHub state (chain, landed merges, branches, status
  files, build-control budget.json + usage.jsonl). Seeded into the DB by ensureBuildsStub().
- github.ts — the read/write facade over the modelled GitHub (builds_files + builds_commits tables in
  stub; GitHub API in live). commit() enforces the write allowlist (spec §3 / check 4): throws on any
  path other than docs/sessions/*-status.md, docs/claude/chain.md, budget.json.
- state.ts — stage derivation (Queued/Building/Needs Josh/Landed), question parsing (process.md §5
  format), PICK UP HERE, last activity, last landing, "No activity for [x]h" (3h amber).
- budget.ts — this-week usage total (Monday 2:00 AM Eastern reset), pct, HOLD (at/over limit, no
  override in force), warn level, Override (writes override_until, default next Monday 2:00 AM).
- writer.ts — commitAnswer (status file + chain.md, one commit, [skip ci]) and commitBudget.
- updater.ts — reads data/updater-state.json + data/alerts/ (what the §7.4 updater writes) for the
  Command Center card's "Live on Mac mini" and "Update failed, rolled back", and the alert feed.
- view.ts — the whole screen view model + alert counts (bell / red Builds badge).

Migration 0008_builds: tables builds_files, builds_commits; index idx_builds_commits_repo. Tracked
projects and budget override live in app_settings / the stub budget.json, so no extra tables.

Screen /builds (full page under (app)): usage tiles, the budget tile with Override, one card per
project, the Needs-you panel (answer one question at a time, next/previous, submit; then the runner
command with Copy), dashboard-usage chart, recent activity. Nav "Builds" and the top-bar bell become
real links with a red badge/count. Settings gains a "Software builds" card (projects, limit, warn %,
GitHub-token guide). Guide: docs/guides/github_token.md.

Checks (spec §4 = handoff §11 "Builds", minus the touch-screen ones which are CC9):
1. Each build shows the right stage within 2 min of the GitHub change — state derivation.
2. (touch-screen part is CC9) the bell count / red Builds badge update on a new unanswered question.
3. An answer appears in the status file verbatim with the time, chain.md changed in the same commit,
   pushed [skip ci]; the card then shows the runner command.
4. The app writes to GitHub only status files + chain.md on build branches and budget.json.
5. The budget tile matches this week's usage.jsonl total; HOLD shows when the runner would hold;
   Override writes override_until and the next runner start proceeds.
   (checks 6 & 7 — Mac-mini live/rollback — are the §7.4 updater's mechanics, built in CC1; CC8
   displays their state from the local updater files and seeds them for the display test.)

## Checks (spec §4 = handoff §11 "Builds", minus the touch-screen ones which are CC9)

Evidence (unit = tests/unit/cc8-builds.test.ts; browser = tests/e2e/cc8-builds.e2e.ts):
1. Right stage within 2 min of the GitHub change — the 2-minute poll is handoff §7.3; the derivation
   is state.ts. unit "gives each project the right stage", "Needs Josh when … unanswered",
   "landed count / place in chain", "amber after 3h"; browser "Josh reaches Builds … cards … HOLD".
2. The bell count and the red Builds badge update on a new unanswered question (the touch-screen jump
   is CC9) — unit "the red Builds badge counts Needs-Josh projects; the bell adds the hold"; browser
   test 1 asserts nav-count-builds=1 and bell-count=2, test 4 asserts the badge drops to 0 after the
   answer.
3. An answer appears in the status file verbatim with the time, chain.md changed in the same commit,
   pushed [skip ci], then the card shows the runner command — unit "writes the answer verbatim …
   same [skip ci] commit", "runner command once the last question is answered", "refuses twice",
   "inserts under the recommendation"; browser "Josh answers a build question …".
4. The app writes to GitHub only status files + chain.md on build branches and budget.json — unit
   "allows only …", "commit() throws on any disallowed path", "every commit the app records touches
   only allowed paths". Enforced in github.commit() (DisallowedWriteError), not just asserted.
5. The budget tile matches this week's usage.jsonl; HOLD shows when the runner would hold; Override
   writes override_until and the next runner start proceeds — unit "sums this week's usage.jsonl and
   holds", "an override clears the hold", "warns but does not hold", "Budget not set up", "only
   counts usage since the Monday 2:00 AM reset"; browser "Override clears the build-budget hold".
   Checks 6 & 7 (Mac-mini live / rollback) are the §7.4 updater's mechanics, built and tested in CC1
   (updater.test.ts); CC8 only displays their state — unit "shows Live on Mac mini and a rollback
   alert from the local updater files". The deliberately-broken-rollback itself is a CC1/updater
   behaviour, not re-run here.

Local run: unit 163/163, browser 57/57; lint clean; typecheck clean; generated types in sync.

## Decided without asking

- GitHub stubbed with CC_LIVE_GITHUB=1 as the live switch, mirroring CC_LIVE_AI / CC_LIVE_FEEDS. No
  new ruling, widens no access, writes no real data, undoable.
- When the budget hold is on, every queued project reads "Queued · held by budget", not only one
  (process.md §12: "no new build session starts" — nothing queued can start). The mockup shows one
  held card illustratively. Changes no ruling; undoable.
- The answer timestamp is written in the chain-ruling style "YYYY-MM-DD HH:MM" Eastern (as the
  existing rulings in chain.md), not raw ISO. Matches handoff §7.1 "<date time>".
- Christine may also answer build questions (handoff §1.1: she uses the app and sees everything); the
  answer records the acting login's display name. Handoff §7.1's example names Josh.

## Questions

(none)

## Landing

LANDED 2026-11-19. Merge "[Merge] CC8 (Builds screen, build questions, build budget)" into main. CI
green: run 44478042639, both jobs (Lint/types/build/unit: success; Browser tests: success). Spec §4 =
handoff §11 "Builds" checks (minus the touch-screen ones, which are CC9) all pass against the GitHub
stub — see the Checks section above for the per-check evidence. unit 163/163, browser 57/57.

Branch was fast-forwardable onto main (0 behind; merge-base = main tip d241f21). The only commits
after the CI-green commit (f7f827a) are docs (chain.md + CC8-status.md), listed in the merge message,
via: git merge --no-ff cc8-builds. Migration 0008_builds lands with the code; the Mac mini updater
applies it (handoff §7.5) — expected objects: builds_files, builds_commits, idx_builds_commits_repo.
Deploy and smoke after merge are the Mac mini updater's job (handoff §7.4), not this build session.

New waits on Josh (also in chain.md): set the github_token in Settings → Keys
(docs/guides/github_token.md) and CC_LIVE_GITHUB=1 on the Mac mini to read/write real GitHub (the stub
stands in until then); create the private build-control repo, point each runner at it
(BUILD_BUDGET_REPO) and set the weekly build limit in Settings → Software builds (until set, usage is
recorded with no hold). Tracked projects are editable there too.
