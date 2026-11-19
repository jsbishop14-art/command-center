# CC11 build spec: Mac mini install fixes, real Google sign-in, Josh's answers

## 0. Josh's words (verbatim)

- 2026-11-19 05:52, answers to the open questions: "1. a new address. evanmbishop23@gmail.com" (CC4-ASK-1, intake
  mailbox) and "2. i think claude can change the schedule" (EZB-ASK-1).
- 2026-11-19 05:56, asked whether Josh and rule schedule moves should go to EZ Binder labeled as Claude with "moved by
  Josh" or "moved by rule" in the note: "2a- yes if it is already built into the system."
- 2026-11-19 05:56, on the Calendar menu item (CC3-ASK-1): "3. understood. i will test the system and see whats
  needed." Meaning: no standalone Calendar screen now; the menu item stays a later-build placeholder.
- 2026-11-19 07:43: "im back on the windows machine. run fixes now"

Record these four rulings in chain.md (rulings in force) and in this build's status file in the same commit, and mark
CC3-ASK-1, CC4-ASK-1 and EZB-ASK-1 answered in their status files on main.

## 1. What Josh gets

- **Calendars and Gmail really connect.** "Connect" in Settings opens Google's own sign-in and consent screen. After
  Josh (or Christine, for her calendar) signs in, Command Center shows real events and real Gmail threads. Each of the
  three calendars connects to whichever Google account owns it. Gmail (Awaiting reply, nudge drafts) connects to Josh's
  mailbox. The intake mailbox connects separately to evanmbishop23@gmail.com, and notes emailed or texted there become
  pending notes. Disconnect removes the stored tokens. An expired or revoked connection shows in Problems with a
  Reconnect button instead of failing quietly.
- **A Google setup guide** (docs/guides/google_connect.md) in plain steps: create the Google Cloud project, turn on the
  Calendar and Gmail APIs, set up the consent screen, add the Google accounts that will connect as test users, create
  the OAuth client, enter the client ID and secret in Settings, Keys. Say plainly if a consent screen left in "Testing"
  makes connections expire (and how often), and what Josh would do about it.
- **EZ Binder moves labeled as Claude.** When EZ Binder is live, schedule-move proposals that Josh or a slip rule
  makes go to EZ Binder with X-EZB-Actor `claude` and a note naming the real source ("moved by Josh" or "moved by
  rule: <rule name>"). They stay proposals until Josh confirms them in EZ Binder.
- **The installer works on a real Mac** without the manual fixes Josh needed on 2026-11-19:
  1. Values written to the env file are quoted, so a settings folder with a space (the default `~/Library/Application
     Support/CommandCenter`) works.
  2. Both launchd jobs set PATH to include the folder of the `node` that ran the installer, plus /usr/local/bin and
     /opt/homebrew/bin, so `npm` is found.
  3. Both launchd jobs write logs (app.log and updater.log in the settings folder); the install guide says where.
  4. If `~/.cloudflared/config.yml` exists, the installer installs its own launchd job that runs
     `cloudflared tunnel run` for the tunnel named in it (cloudflared's own `service install` on macOS starts the
     program without `tunnel run`).
  5. Re-running the installer on a Mac that is already set up (this Mac mini: settings in `~/.commandcenter`, both
     jobs patched by hand, tunnel job from `cloudflared service install`) leaves a clean, working setup and keeps the
     database, secret key and passwords.
- **Updates no longer break the screens.** The updater builds the new version without replacing the one being served,
  then switches and restarts. No request gets an internal error while an update is building.
- **docs/install-mac.md matches what works:** the steps Josh actually ran (config.yml, `tunnel route dns`, the tunnel
  job), Cloudflare Access with the one-time PIN login (the Cloudflare identity provider is the new default and must be
  turned off for this app), and the Bypass application for /api/notes, /api/phone/* and /api/ezbinder/webhook.

## 2. Scope

- Handoff rows for Google Calendar and Gmail (§7.3, the Today panel, Awaiting reply, intake) on the live path. The
  stub path stays the default in CI and build sessions.
- Settings, Keys: Google OAuth client ID and secret, kept in the secret store.
- The installer, both launchd jobs, the updater's build-and-switch, the install guide.
- The EZ Binder actor change above.

## 3. Must stay true

- No real Google calls from CI or the build session. The OAuth flow, token refresh and the API calls are tested against
  a stub Google that issues tokens, refreshes them and returns events, threads and messages.
- Tokens and the client secret live only in the secret store. Never in logs, tests, kanban files or the repo.
- The app never sends email. Gmail scopes allow reading and creating drafts only; a test asserts the requested scopes
  contain no send scope and no send call exists.
- Christine can connect her own calendar; nothing about her login changes.
- Nothing calls Claude outside the Sync button.
- The OAuth redirect works both at http://localhost:<port> on the Mac mini and through the tunnel hostname; the
  redirect URI shown in Settings is the one Josh registers in Google.

## 4. Checks

1. Connect, refresh and disconnect for each calendar, Gmail and the intake mailbox against the stub Google, signed in
   as Josh and as Christine, reached by clicking from Settings.
2. An expired or revoked token raises a Problem with Reconnect, and Reconnect restores the feed.
3. The Today panel shows stub events from a connected calendar on the live code path (stub Google, live switch on).
4. Intake: a stub message in the intake mailbox becomes one pending note; a second poll creates no duplicate.
5. Awaiting reply and nudge drafts work through the live path against the stub; no send scope, no send call.
6. EZ Binder: a Josh move and a rule move post with X-EZB-Actor `claude` and the source note (stub).
7. Installer dry run in a fake HOME whose settings path contains a space: the env file is quoted and sources cleanly,
   both plists contain PATH and log paths, and the tunnel job is written when a config.yml exists and not otherwise.
8. Updater: a simulated update keeps answering requests during the build and switches only after the build succeeds;
   a failed build leaves the running version untouched.

## 5. Not in this build

A standalone Calendar screen (Josh will decide after testing). Sending email. Publishing the Google consent screen
for outside users.

## 6. Grant

None. No real Google, EZ Binder or Cloudflare calls. Production is the Mac mini; the updater applies this build.

## 7. Waits on Josh after landing

Creating the Google Cloud project and OAuth client per the guide, entering the client ID and secret, setting
CC_LIVE_FEEDS=1 in `~/.commandcenter/env`, then connecting the three calendars, Gmail and evanmbishop23@gmail.com.
