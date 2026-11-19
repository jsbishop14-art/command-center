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

Build started. Plan (commit + push feature branch after each step; ONE deliberate CI run near the end):

1. Migration 0009_phone_lookup + generated types + scoring config file.
2. Phone lib: mode, normalize, stub, twilio (30-day cache), ftc (backfill/daily ingest/prune), fcc (3s timeout),
   scoring, store, lookup orchestrator, history, view.
3. Phone screen (/phone) + server actions, API routes (/api/phone/lookup, /api/phone/mark) with the Shortcut token,
   Quick-add number recognition, Settings scoring-config card, Nav entry, iPhone lookup Shortcut guide.
4. Tests: cc10-phone unit + cc10-phone / cc10-api-phone e2e; add branch to CI; deliberate CI run.
5. Land.

## Decided without asking

(none yet)

## Questions for Josh

(none)
