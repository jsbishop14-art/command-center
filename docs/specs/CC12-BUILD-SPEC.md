# CC12 build spec: updater fixes, daily updates, stay signed in

## 0. Josh's words (verbatim)

- 2026-11-19 16:11: "every 5 minutes seems excessive. it should be once a day and then on command."
- 2026-11-19 16:13, answers to "1. What time of day should the daily update run? I recommend 3:00 AM" and "2. Should
  'on demand' be a 'Check for updates now' button in Settings that also shows when the last update ran?": "ok" and
  "yes".
- 2026-11-19 17:33: "i have all of the tokens. they didnt save again and i was signed out. its running fine when
  signed back in but i shouldnt have to sign in so often. in fact, when im in i dont want to ever have to sign in
  again"
- 2026-11-19 17:35: "plan and fix now"

Record these rulings in chain.md (rulings in force) and in this build's status file in the same commit.

## What happened on the Mac mini (2026-11-19, from ~/.commandcenter/updater.log and Josh's Terminal output)

- The updater never had a live version recorded (data/updater-state.json liveMerge null), so every 5-minute pass saw
  "a new merge" and ran a full update.
- Each update failed at smoke: scripts/smoke.ts signs in with CC_JOSH_PASSWORD / CC_CHRISTINE_PASSWORD, which are not
  in the updater's environment on the Mac, so it used the dev passwords and failed against the real ones.
- Each failure rolled back: it restored the database file from the copy taken at the start of the pass, ran
  `git checkout --force <prevSha>` (leaving the repo in detached HEAD) and restarted the app. Keys saved and sessions
  started during the pass were lost every time, so Josh's keys "didn't save" and he was signed out.
- At some point a reinstall left node_modules without dev dependencies, so `npm run migrate` failed with
  "tsx: command not found", and migration 0010 had to be applied by hand.
- The updater is now stopped (`launchctl unload`). It stays off until this build is installed by hand (section 7).

## 1. What Josh gets

- **Updates once a day at 3:00 AM Eastern, plus on command.** Settings gets an Updates section: the version that is
  live (merge title and date), when the last check ran and its result, and a **Check for updates now** button that
  runs one pass right away and shows the outcome. No 5-minute polling.
- **Updates never lose his data.** A failed update never rolls the database back to an older copy unless that update
  had already changed the database (applied a migration). Keys, sessions, settings and anything else saved while an
  update runs are kept. If a rollback of the database is truly needed, it first copies the current database aside and
  says so in the alert.
- **The repo stays on main.** Rollback goes back to the previous merge without leaving the repo in detached HEAD in a
  way that blocks the next update; the next update starts cleanly from main.
- **The smoke check works with his real logins** without storing his passwords anywhere new. Use a check that proves
  both logins can reach Home without knowing the passwords (for example, a short-lived smoke session minted by the
  updater itself, or the health route reporting both users present and sign-in working). Never put real passwords in
  the env file or the repo.
- **The live version is recorded at install,** so the first updater pass after install does nothing when the code is
  already current.
- **Dev tools needed on the Mac stay installed.** Every `npm ci` the installer and updater run keeps what migrate,
  smoke and the updater need (`--include=dev`, or move `tsx` to dependencies). A missing tool fails loudly before
  anything is changed.
- **Stay signed in.** A Command Center session renews itself each time it is used (sliding expiry), so Josh and
  Christine stay signed in as long as they use the app at least once in the renewal window (choose a long window,
  such as a year, and log the choice). Sign out still works. Restarting the app or an update never signs anyone out.
- **The settings file keeps working** with the lines Josh added by hand (CC_LIVE_FEEDS, CC_PUBLIC_URL, CC_LIVE_PHONE)
  and the unquoted CC_SECRET_KEY / CC_DB_PATH lines written before CC11.

## 2. Scope

The updater (schedule, state, rollback, smoke), the installer (record live version, keep dev tools, updater launchd
schedule), sessions, a Settings Updates section, docs/install-mac.md (how updates work, the manual update command).

## 3. Must stay true

- Production is the Mac mini; build sessions never touch it.
- No passwords or secrets in the repo, logs or env file beyond what is already there.
- Nothing calls Claude outside the Sync button.
- An update that fails before switching leaves the running app and its data exactly as they were.

## 4. Checks

1. Updater state: after install the live version is recorded; a pass with no new merge does nothing.
2. Schedule: the updater launchd job runs once a day at 3:00 AM Eastern (StartCalendarInterval), not in a 5-minute
   loop; Check for updates now runs one pass and reports the result in Settings (browser test, as Josh and Christine,
   reached from the menu).
3. A failed smoke after an update without a migration restores the previous build and leaves the database untouched:
   a key saved and a session started during the update are still there afterwards.
4. A failed update after a migration copies the current database aside before restoring, and the alert names both.
5. The smoke check passes against a database whose passwords are not the dev defaults, with no password supplied.
6. After a rollback the repo is on main (or the next pass recovers to main) and the next update succeeds.
7. Sliding sessions: a session used within the window is extended; restart does not invalidate sessions.
8. Installer dry run: npm ci keeps dev dependencies; the updater plist uses StartCalendarInterval 03:00.

## 5. Not in this build

Changing the Cloudflare Access session length (done in the Cloudflare dashboard, not in code).

## 6. Grant

None. No real outside calls.

## 7. Waits on Josh after landing

The updater is unloaded on the Mac mini, so this build is installed by hand once, then updates run themselves:

```
cd ~/command-center
git fetch origin && git checkout -B main origin/main
CC_CONFIG_DIR="$HOME/.commandcenter" sh scripts/install-mac.sh
```

Write the exact command into docs/install-mac.md under "Updating by hand".
