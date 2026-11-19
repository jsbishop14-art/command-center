# CC10 status: phone lookup

Branch: cc10-phone-lookup (from origin/main). Spec: docs/specs/CC10-BUILD-SPEC.md. Handoff: section 8 (all),
section 11 "Phone lookup" checks. Layout: docs/mockup/PhoneLookup.dc.html.

## RESUME block

### Spec section 0 (Josh's words, verbatim)

- 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that session will
  create the repo and/or anything else needed and start the build"
- Requirements: handoff section 8 (all). Layout: docs/mockup/PhoneLookup.dc.html.

### This session's prompt (verbatim)

Unattended run in a FRESH session, started by scripts/run_chain.py. Your job is ONLY build CC10.
1. Read CLAUDE.md, docs/claude/chain.md and the handoff sections your spec names. If docs/specs/CC10-BUILD-SPEC.md is not on main, bring it
   from origin/docs/next-builds with your first commit.
2. git fetch origin. If origin/cc10-phone-lookup exists: check it out, report git status (never discard uncommitted work), read
   docs/sessions/CC10-status.md and continue from PICK UP HERE. Otherwise create cc10-phone-lookup from origin/main and the
   status file with a RESUME block quoting the spec's section 0 and this prompt verbatim.
3. Build docs/specs/CC10-BUILD-SPEC.md per docs/process.md section 4 (decide and log; hard stops only). Commit and push the feature branch
   after every step. ONE deliberate CI run. Keep a tool call printing output at least every 20 minutes.
4. No production grant. Production is Josh's Mac mini, which build sessions never touch (handoff section 7.5). Migrations land with the code and the Mac mini updater applies them. No real outside calls: use the stubs. No real email, ever.
5. Land per the landing rule as adapted in CLAUDE.md (handoff section 7.5). The merge commit message MUST start with
   "[Merge] CC10 (". The Mac mini updater deploys and smoke-checks after the merge (handoff section 7.4). Record the
   landing in chain.md and the status file.
6. Then STOP. Do not start the next build. If a hard stop or a question for Josh blocks landing, write it in the status
   file's Questions section (plain text, full question, options, recommendation), push, and end. If the status file
   already holds questions with NO recorded answer, change nothing and end at once, saying so: Josh answers through the
   chat session or the Command Center dashboard, which record the answers in the status file.

## PICK UP HERE

Build complete locally; the single deliberate CI run is pushed (ALLOW_CI=1). On CI green, land per
the rule (fast-forwardable onto main, docs-only commits after the green commit listed in the merge
message). If CI is red, fix within the budget (1 + 2 infra + 2 fix) and re-run.

Built:
1. Migration 0009_phone_lookup (ftc_counts, ftc_sync_state, twilio_cache, phone_lookups,
   phone_marks + idx_ftc_counts_phone, idx_phone_lookups_phone, idx_phone_lookups_created);
   generated types; scoring config (src/lib/phone/config.ts, app_settings key phone_scoring).
2. Phone lib (src/lib/phone/): mode, dates, normalize, stub, store, twilio (30-day cache),
   ftc (resumable month-paged backfill + daily ingest + prune + lazy ensure), fcc (3s timeout →
   unavailable), scoring, lookup orchestrator, view, jobs (live-only background timer).
3. /phone screen + server actions; /api/phone/lookup (POST) + /api/phone/mark (PUT/DELETE) gated by
   the Shortcut token; Quick-add number recognition; Settings scoring-config card; Nav entry;
   docs/guides/iphone_phone_shortcut.md.
4. Tests + CI branch add + permissions inversion.

## Evidence (spec §4 = handoff §11 "Phone lookup", against the stubs)

- Returns a verdict with reasons for any US number in any format, desktop and Shortcut:
  cc10-phone unit (normalize + lookup orchestrator), cc10-phone e2e check 1, cc10-api-phone e2e.
- Makes no Claude calls; a repeat lookup within 30 days makes no Twilio call: cc10-phone unit
  (twilioFetchCount stays 1 on repeat; refresh/>30d refetch) + no-AI import scan.
- FTC backfill stops and resumes without losing progress; daily ingest runs and prunes >12 months:
  cc10-phone unit (backfillStep/runBackfill resume, idempotent 24-total, pruneFtc/dailyIngest).
- An FCC timeout still returns a result marked "FCC data unavailable": cc10-phone unit (injected
  never-resolving/throwing fetcher → available:false) + scoring reason.
- A spam/real mark overrides the verdict for both users; removing it restores scoring: cc10-phone
  unit + e2e check 5 (Josh marks, Christine sees "Marked spam by Josh", remove restores).
- Lookup history older than 90 days is deleted: cc10-phone unit (pruneHistory).
- The Shortcut token works only on the phone and note routes and stops working once revoked:
  cc10-api-phone e2e (token allows lookup/mark; Claude token refused), permissions e2e (401 without
  token), cc10-phone unit (revoke → isValidShortcutToken false). The refusal on other routes is in
  cc4-api-shortcut + permissions.
- The 80% test-list check is Josh's, after the keys are in (spec §2, §4).
- Each login reaches Phone lookup from the left menu; not tied to a board (§8.8): cc10-phone e2e
  (josh + christine). Touch screen stays display-only (no phone lookup): cc9-touch e2e unchanged.

Tallies: unit 212/212, browser 73/73. Lint/types/build clean. CI green: run 44486999240, both jobs
(Lint/types/build/unit: success; Browser tests: success).

## Landed

CC10 landed 2026-11-19. Merge into main starts "[Merge] CC10 (". CI green run 44486999240, both
jobs. Branch fast-forwardable onto main (0 behind; merge-base = main tip 104f72f); the only commits
after the CI-green commit 41c2001 are docs (chain.md + CC10-status.md), listed in the merge message,
via git merge --no-ff cc10-phone-lookup. Migration 0009_phone_lookup lands with the code; the Mac
mini updater applies it (handoff §7.5) — expected objects: ftc_counts, ftc_sync_state, twilio_cache,
phone_lookups, phone_marks, idx_ftc_counts_phone, idx_phone_lookups_phone, idx_phone_lookups_created.
Deploy and smoke after merge are the Mac mini updater's job (handoff §7.4). Recorded in chain.md.

## Decided without asking

- FTC ingest modelled as month pages (newest-first) across the 12-month window, not the real API's
  day pages. The handoff's day-paged daily ingest is aggregated per month in the stub; each page is
  an idempotent SET so a resumed/repeated page never double-counts. Satisfies the resumable-backfill
  and 12-month-prune checks. The live path (Mac mini only, never tested) pages the real API per
  month. Changes no ruling, widens no access, writes no real data, reversible.
- Shortcut lookups and marks are attributed to user `josh` (the iPhone is Josh's; the handoff gives
  the Shortcut one token and does not distinguish the two logins). History shows "Josh · Shortcut".
- The /api/phone routes accept the Shortcut token ONLY (like /api/notes in CC4); the desktop screen
  uses server actions, not these routes. Matches handoff §8.7 and roles §7.
- CC_LIVE_PHONE=1 is the Mac-mini live switch (mirrors CC_LIVE_FEEDS / CC_LIVE_AI / CC_LIVE_GITHUB);
  off everywhere else so no build session or CI job makes a real Twilio/FTC/FCC call.

## Waits on Josh (for go-live on the Mac mini)

- Set the three keys in Settings → Keys: Twilio account SID + auth token, FTC (api.data.gov) key,
  FCC app token; then set CC_LIVE_PHONE=1. Until then the stub stands in (deterministic data).
- Issue the iPhone Shortcut token in Settings → Inbox & email and build the Lookup Shortcut from
  docs/guides/iphone_phone_shortcut.md (one token covers the note and phone Shortcuts).
- Supply 15–20 known numbers and run the test list; tune points/thresholds in Settings → Phone
  lookup (handoff §8.4) to reach ≥80% match (spec §2, §4 — Josh's check).

## Questions for Josh

(none)
