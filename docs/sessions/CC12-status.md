# CC12 status: updater fixes, daily updates, stay signed in

Branch: cc12-updater-sessions. Spec: docs/specs/CC12-BUILD-SPEC.md. Handoff: §7.4 (updater), §7.5
(landing), §1.1 (install).

## RESUME HERE

If you are a fresh session picking this up: read this whole file, then PICK UP HERE at the first
unchecked step in "Plan / progress" below. Never discard uncommitted work; run `git status` first.

### Spec §0 (Josh's words, verbatim)

- 2026-11-19 16:11: "every 5 minutes seems excessive. it should be once a day and then on command."
- 2026-11-19 16:13, answers to "1. What time of day should the daily update run? I recommend 3:00 AM"
  and "2. Should 'on demand' be a 'Check for updates now' button in Settings that also shows when the
  last update ran?": "ok" and "yes".
- 2026-11-19 17:33: "i have all of the tokens. they didnt save again and i was signed out. its
  running fine when signed back in but i shouldnt have to sign in so often. in fact, when im in i dont
  want to ever have to sign in again"
- 2026-11-19 17:35: "plan and fix now"

### The run prompt (verbatim)

Unattended run in a FRESH session, started by scripts/run_chain.py. Your job is ONLY build CC12.
1. Read CLAUDE.md, docs/claude/chain.md and the handoff sections your spec names. If
   docs/specs/CC12-BUILD-SPEC.md is not on main, bring it from origin/docs/next-builds with your first
   commit.
2. git fetch origin. If origin/cc12-updater-sessions exists: check it out, report git status (never
   discard uncommitted work), read docs/sessions/CC12-status.md and continue from PICK UP HERE.
   Otherwise create cc12-updater-sessions from origin/main and the status file with a RESUME block
   quoting the spec's section 0 and this prompt verbatim.
3. Build docs/specs/CC12-BUILD-SPEC.md per docs/process.md section 4 (decide and log; hard stops
   only). Commit and push the feature branch after every step. ONE deliberate CI run. Keep a tool
   call printing output at least every 20 minutes.
4. No production grant. Production is Josh's Mac mini, which build sessions never touch (handoff
   section 7.5). Migrations land with the code and the Mac mini updater applies them. No real outside
   calls: use the stubs. No real email, ever.
5. Land per the landing rule as adapted in CLAUDE.md (handoff section 7.5). The merge commit message
   MUST start with "[Merge] CC12 (". The Mac mini updater deploys and smoke-checks after the merge
   (handoff section 7.4). Record the landing in chain.md and the status file.
6. Then STOP. Do not start the next build. If a hard stop or a question for Josh blocks landing, write
   it in the status file's Questions section (plain text, full question, options, recommendation),
   push, and end. If the status file already holds questions with NO recorded answer, change nothing
   and end at once, saying so: Josh answers through the chat session or the Command Center dashboard,
   which record the answers in the status file.

## What went wrong on the Mac mini (from the spec)

- updater-state.json never recorded a live version (liveMerge null), so every 5-minute pass saw "a
  new merge" and ran a full update.
- Each update failed at smoke because scripts/smoke.ts needed CC_JOSH_PASSWORD / CC_CHRISTINE_PASSWORD
  which were not in the updater env, so it used the dev passwords against the real ones.
- Each failure rolled the database back to the start-of-pass copy, did `git checkout --force
  <prevSha>` (detached HEAD) and restarted — losing keys saved and sessions started during the pass.
  That is why Josh's keys "didn't save" and he was signed out.
- A reinstall left node_modules without dev deps, so `npm run migrate` failed with "tsx: command not
  found"; migration 0010 was applied by hand.
- The updater is now unloaded on the Mac mini; it stays off until this build is installed by hand
  (spec §7).

## Decisions (Decided without asking — none change Josh's rulings, widen access, write real data, or
can't be undone)

- D1. Sliding-session window = 365 days (one year). Spec §1 "Stay signed in": choose a long window and
  log it. A session is extended to now + 365 days on every use (any request that resolves the current
  user), so Josh and Christine never sign in again as long as they use the app within a year. Sign out
  still deletes the session; a restart never touches sessions (they live in the database).
- D2. Daily update time is 3:00 AM in the Mac mini's local time (Eastern), set with launchd
  StartCalendarInterval {Hour 3, Minute 0}. launchd uses local time; the Mac mini is Eastern, matching
  Josh's "3:00 AM Eastern". The updater plist no longer uses a 5-minute loop or KeepAlive.
- D3. "Check for updates now" reports a result in dev/CI without a real git/build pass. On the Mac
  mini (CC_UPDATER_LIVE=1) the button spawns one real updater pass; elsewhere it runs the same pure
  runUpdate() over ops that report "up to date" so the button and its result wiring are exercised in a
  browser test without touching git or the network. The last check (time + outcome + detail) is stored
  in updater-state.json by every pass — the 3 AM run and the button alike.
- D4. Smoke check proves both logins reach Home by minting a short-lived session (60 s) straight into
  the database for each user and fetching /home with it — no password needed and none stored anywhere
  new (spec §1, check 5). The session rows are deleted after the check.
- D5. "Keep dev tools": both the installer and the updater run `npm ci --include=dev`, and the
  installer fails loudly (before changing anything else) if `tsx` is not resolvable afterwards. tsx
  stays a devDependency.
- D6. Repo stays on main after a rollback: restore resets the `main` branch to the previous merge and
  checks out `main` (no detached HEAD); the next pass fetches and fast-forwards cleanly.

## Plan / progress (commit + push after each step)

- [x] 1. Status file + chain.md rulings; bring CC12 spec onto the branch. (commit fcc0d6b)
- [x] 2. Sliding sessions (auth.ts over sessions.ts), unit tests. No old 30-day assertion existed to
      invert (SESSION_DAYS had no test); the new window is covered by sessions.test.ts. (commit e0d5e79)
- [x] 3. Updater core: restore DB only after a migration; copy current DB aside first and name both
      in the alert; stay on main (recoverToMain); record lastCheck. ops.ts + build.ts. (commit 8e23855)
- [x] 4. run.ts one pass + --record-live; smoke.ts mints a short-lived session (no passwords);
      mintSmokeSession helper + unit test (non-default passwords). (commit 22ea554)
- [x] 5. Installer: npm ci --include=dev + loud tsx check; updater plist StartCalendarInterval 03:00
      (no loop/KeepAlive); record live at install. install-dryrun test. (commit e80959a)
- [x] 6. Settings Updates section (live version, last check, Check for updates now) + browser test;
      docs/install-mac.md updates + "Updating by hand". (commit 3f6ed36)
- [x] 7. Added cc12-updater-sessions to CI branch list; full local unit 247/247 + e2e 79/79; one CI
      run (ALLOW_CI=1); land with "[Merge] CC12 (". Landing recorded below and in chain.md.

## Checks (spec §4) — evidence filled in as built

1. PASS. The installer records the live version at install (`npm run updater -- --record-live`,
   install-mac.sh section 3b; recordLiveFromHead in scripts/updater/ops.ts). runUpdate() step 1
   returns up-to-date when latestMergeOnMain === liveMerge, running nothing (updater.test.ts "up to
   date when the latest merge is already live"; install-dryrun "records the live version"). D3 dev
   path confirms the Check now button reports "up to date" when already current.
2. PASS. Updater plist uses StartCalendarInterval {Hour 3, Minute 0} and no `--loop`/KeepAlive
   (install-dryrun "schedules the updater once a day at 03:00 … not a 5-minute loop"). Check for
   updates now runs one pass and reports the result in Settings → Updates, reached from the menu as
   Josh and Christine (tests/e2e/cc12-updates.e2e.ts, 2 tests).
3. PASS. runUpdate() rolls the database back only when a migration ran; with none it calls
   restore({restoreDatabase:false}) and the alert says "No migration ran … kept" (updater.test.ts
   "does NOT roll the database back when no migration ran"). Keys/sessions saved during the update
   live in the untouched database, so they survive.
4. PASS. With a migration, restore({restoreDatabase:true}) copies the current database aside first
   (ops.ts restore → db-before-rollback-<stamp>.db) and the alert names both the migration and the
   aside path (updater.test.ts "rolls the database back when a migration ran, copying the current
   database aside and naming both").
5. PASS. smoke.ts mints a short-lived session per login straight into the database and fetches /home
   with it — no password supplied, none stored (sessions.test.ts "mints a session that resolves to
   the user when the password is not a dev default"; "the smoke script reads no password from the
   environment").
6. PASS. restore uses recoverToMain(git, prevSha) = `git checkout main` + `git reset --hard
   <prevSha>` — the repo is left on main, never detached, so the next pass's `checkout main` +
   `pull --ff-only` fast-forwards (updater.test.ts, real temp-git test "returns from a detached HEAD
   to main at the previous merge").
7. PASS. resolveSession slides expires_at to now + 365 days on every use; an unused-past-window
   session is pruned; a reopened database (restart) still resolves the session; sign out deletes it
   (sessions.test.ts, 5 tests).
8. PASS. install-dryrun "runs npm ci with --include=dev and records the live version" (no bare
   `npm ci`) and "schedules the updater once a day at 03:00 via StartCalendarInterval".

Totals: unit 247/247, browser 79/79 (local).

## Landing

Landed 2026-11-19. Merge "[Merge] CC12 (updater fixes, daily updates, stay signed in)" into main.
CI green: run 44633419418, both jobs success (Lint/types/build/unit; Browser tests). Branch was
fast-forwardable onto main (0 behind; merge-base = main tip 7021005). The CI-green commit 35302e8
added cc12-updater-sessions to the CI branch list; the only commits after it are docs (chain.md +
this status file), listed in the merge message, via `git merge --no-ff cc12-updater-sessions`. No new
migration in this build. unit 247/247, browser 79/79. The Mac mini updater deploys and smoke-checks
after the merge (handoff §7.4) — but see "Waits on Josh" below: the updater is unloaded, so this
build is installed by hand once first.

## Questions for Josh

None.

## Waits on Josh after landing (spec §7)

The updater is unloaded on the Mac mini. Install this build by hand once; then updates run
themselves (daily at 3 AM Eastern, or the Check for updates now button):

```
cd ~/command-center
git fetch origin && git checkout -B main origin/main
CC_CONFIG_DIR="$HOME/.commandcenter" sh scripts/install-mac.sh
```

(The exact command is also written in docs/install-mac.md under "Updating by hand".)
