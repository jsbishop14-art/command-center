# CC11 status: Mac mini install fixes, real Google sign-in, Josh's answers

Branch: cc11-mac-fixes-google (from origin/main). Spec: docs/specs/CC11-BUILD-SPEC.md. Handoff: §2 (Today, Awaiting
reply, intake), §2.1 (nudge), §2.2 / §7.2 (EZ Binder actor), §4.4 (intake), §7.3 (feeds), §7.4 (updater), §1.1 /
§7.4 (installer). Layout: no new screen (Settings panels reused).

## RESUME block

### Spec section 0 (Josh's words, verbatim)

- 2026-11-19 05:52, answers to the open questions: "1. a new address. evanmbishop23@gmail.com" (CC4-ASK-1, intake
  mailbox) and "2. i think claude can change the schedule" (EZB-ASK-1).
- 2026-11-19 05:56, asked whether Josh and rule schedule moves should go to EZ Binder labeled as Claude with "moved by
  Josh" or "moved by rule" in the note: "2a- yes if it is already built into the system."
- 2026-11-19 05:56, on the Calendar menu item (CC3-ASK-1): "3. understood. i will test the system and see whats
  needed." Meaning: no standalone Calendar screen now; the menu item stays a later-build placeholder.
- 2026-11-19 07:43: "im back on the windows machine. run fixes now"

### This session's prompt (verbatim)

Unattended run in a FRESH session, started by scripts/run_chain.py. Your job is ONLY build CC11.
1. Read CLAUDE.md, docs/claude/chain.md and the handoff sections your spec names. If docs/specs/CC11-BUILD-SPEC.md is not on main, bring it
   from origin/docs/next-builds with your first commit.
2. git fetch origin. If origin/cc11-mac-fixes-google exists: check it out, report git status (never discard uncommitted work), read
   docs/sessions/CC11-status.md and continue from PICK UP HERE. Otherwise create cc11-mac-fixes-google from origin/main and the
   status file with a RESUME block quoting the spec's section 0 and this prompt verbatim.
3. Build docs/specs/CC11-BUILD-SPEC.md per docs/process.md section 4 (decide and log; hard stops only). Commit and push the feature branch
   after every step. ONE deliberate CI run. Keep a tool call printing output at least every 20 minutes.
4. No production grant. Production is Josh's Mac mini, which build sessions never touch (handoff section 7.5). Migrations land with the code and the Mac mini updater applies them. No real outside calls: use the stubs. No real email, ever.
5. Land per the landing rule as adapted in CLAUDE.md (handoff section 7.5). The merge commit message MUST start with
   "[Merge] CC11 (". The Mac mini updater deploys and smoke-checks after the merge (handoff section 7.4). Record the
   landing in chain.md and the status file.
6. Then STOP. Do not start the next build. If a hard stop or a question for Josh blocks landing, write it in the status
   file's Questions section (plain text, full question, options, recommendation), push, and end. If the status file
   already holds questions with NO recorded answer, change nothing and end at once, saying so: Josh answers through the
   chat session or the Command Center dashboard, which record the answers in the status file.

## PICK UP HERE

LANDED 2026-11-19. Merge "[Merge] CC11 (Mac install fixes, real Google sign-in, Josh's answers)" into main. CI green:
run 44533714010, both jobs (Lint/types/build/unit: success; Browser tests: success). Branch fast-forwardable onto
main (0 behind; merge-base = main tip 0157472); CI-green commit c3d0089; the only commits after it are docs
(chain.md + this file), listed in the merge message. Migration 0010_google_oauth lands with the code (expected
objects: google_oauth_pending, feed_problems); the Mac mini updater applies it. Nothing left to do here — see
"Waits on Josh after landing" below.

## Built

1. Migration 0010_google_oauth (google_oauth_pending, feed_problems); generated types. Google OAuth client
   (src/lib/feeds/google.ts): stub + real transport chosen by liveGoogle(), token bundles in the secret store,
   refresh, scopes (readonly + draft-create, NO send scope), pending-state CSRF, feed-problem store, calendar/Gmail
   reads, draft-create. Connections orchestration (connections.ts), shared sample data (samples.ts), connect-url.ts.
2. OAuth routes: GET /api/auth/google/start, /callback, /stub-consent (same-origin redirects via the Host header).
   Settings Google sign-in (Connect/Reconnect as links), redirect URI shown, intake-mailbox connect, Google client
   ID/secret in Keys. Problems screen lists expired/revoked connections with a Reconnect button. Disconnect server
   action.
3. EZ Binder: schedule-move proposals post with X-EZB-Actor claude and a note naming the real source ("moved by
   Josh" / "moved by rule: schedule slip"); dashboard keeps the real source and original note (proposals.ts).
4. Installer (scripts/install-mac.sh): quoted env values, PATH + log paths in both launchd jobs, cloudflared
   tunnel-run job when ~/.cloudflared/config.yml exists, idempotent re-run keeping db/key/passwords. Updater
   build-and-switch (scripts/updater/build.ts + core/ops): build into CC_DIST_DIR staging, activate only after a
   successful build + read-back, restore the previous build on rollback.
5. Docs: docs/guides/google_connect.md; docs/install-mac.md rewritten (config.yml + tunnel-run job, Cloudflare
   Access one-time PIN with the Cloudflare IdP off, Bypass apps, logs, re-run safety, build-and-switch).
6. Tests: cc11 unit (19), install-dryrun +2, cc11-google e2e (6); CI branch list adds cc11-mac-fixes-google.

## Evidence (spec §4, against the stubs)

1. Connect/refresh/disconnect each calendar, Gmail and the intake mailbox clicked from Settings, Josh and Christine:
   cc11-google e2e (josh all targets; christine her calendar).
2. Expired/revoked → Problem with Reconnect that restores the feed: cc11 unit (revoked stub refresh → feed_problem;
   reconnect clears it and events return) + cc11-google e2e (seeded Problem, Reconnect button, cleared after).
3. Today panel shows stub events on the live code path (CC_LIVE_FEEDS=1, stub Google): cc11 unit.
4. Intake: one pending note per message; a second poll creates none: cc11 unit.
5. Awaiting reply and nudge drafts on the live path; no send scope, no send call: cc11 unit (scopesFor + static
   scan of google.ts/gmail.ts for send endpoints/scope).
6. Josh and rule moves post X-EZB-Actor claude with the source note: cc11 unit (createProposal + stubProposalLog;
   ezbOutbound mapping).
7. Installer dry run in a spaced path: quoted env sources cleanly, both plists carry PATH + log paths, tunnel job
   only when config.yml exists: install-dryrun unit (+2).
8. Updater builds into staging and switches only after a successful build; a failed build leaves the served version
   untouched: cc11 unit (stageBuild/activateBuild/restoreBuild) + updater unit (activate ordering; no activate on
   apply failure).

Totals: unit 235/235, browser 77/77 (local); CI run 44533714010 green (both jobs).

## Waits on Josh after landing

Create the Google Cloud project and OAuth client per docs/guides/google_connect.md; enter the Google OAuth client
ID and secret in Settings → Keys; set CC_LIVE_FEEDS=1 in the Mac mini env; connect the three calendars, Gmail and
evanmbishop23@gmail.com in Settings. Set up Cloudflare Access (one-time PIN, Cloudflare identity provider off,
Bypass apps for /api/notes, /api/phone/*, /api/ezbinder/webhook) and write ~/.cloudflared/config.yml, then re-run
the installer to add the tunnel-run launchd job (docs/install-mac.md). Whether to publish the Google consent screen
(to avoid the 7-day Testing-mode reconnect) is Josh's choice (google_connect.md).

## Josh's rulings this build (also in chain.md)

- CC4-ASK-1 answered: the intake mailbox is a new address, evanmbishop23@gmail.com (2026-11-19 05:52).
- EZB-ASK-1 answered: Claude can change the schedule; Josh/rule moves go to EZ Binder as actor `claude` with a note
  naming the real source ("moved by Josh" / "moved by rule: <name>"), staying proposals until Josh confirms
  (2026-11-19 05:52, 05:56, 05:56 "2a- yes if it is already built into the system").
- CC3-ASK-1 answered: no standalone Calendar screen now; the menu item stays a later-build placeholder
  (2026-11-19 05:56).

## Decided without asking

(recorded as the build proceeds)

## Questions for Josh

None.
