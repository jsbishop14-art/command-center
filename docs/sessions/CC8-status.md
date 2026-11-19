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

Step 0 done: branch cc8-builds created from origin/main; CC8 spec brought from
origin/docs/next-builds; this status file written. Building per the plan below.

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

## Decided without asking

- GitHub stubbed with CC_LIVE_GITHUB=1 as the live switch, mirroring CC_LIVE_AI / CC_LIVE_FEEDS. No
  new ruling, widens no access, writes no real data, undoable.

## Questions

(none)

## Landing

(pending)
