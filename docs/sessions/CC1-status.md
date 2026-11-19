# CC1 status: foundation, logins and the Mac mini updater

Branch: cc1-foundation. Spec: docs/specs/CC1-BUILD-SPEC.md. Handoff sections: 1, 1.1, 1.3, 7.4, 7.5.

## RESUME

### Josh's words (verbatim, from spec §0)

- 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that session will
  create the repo and/or anything else needed and start the build"
- Requirements: Josh's Command Center Build Handoff v3 (docs/specs/COMMAND-CENTER-HANDOFF.md). Rulings in force:
  docs/claude/chain.md. Layout: docs/mockup/.

### Starting prompt (verbatim)

Unattended run in a FRESH session, started by scripts/run_chain.py. Your job is ONLY build CC1.
1. Read CLAUDE.md, docs/claude/chain.md and the handoff sections your spec names. If docs/specs/CC1-BUILD-SPEC.md is not on main, bring it
   from origin/docs/next-builds with your first commit.
2. git fetch origin. If origin/cc1-foundation exists: check it out, report git status (never discard uncommitted work), read
   docs/sessions/CC1-status.md and continue from PICK UP HERE. Otherwise create cc1-foundation from origin/main and the
   status file with a RESUME block quoting the spec's section 0 and this prompt verbatim.
3. Build docs/specs/CC1-BUILD-SPEC.md per docs/process.md section 4 (decide and log; hard stops only). Commit and push the feature branch
   after every step. ONE deliberate CI run. Keep a tool call printing output at least every 20 minutes.
4. No production grant. Production is Josh's Mac mini, which build sessions never touch (handoff section 7.5). Migrations land with the code and the Mac mini updater applies them. No real outside calls: use the stubs. No real email, ever.
5. Land per the landing rule as adapted in CLAUDE.md (handoff section 7.5). The merge commit message MUST start with
   "[Merge] CC1 (". The Mac mini updater deploys and smoke-checks after the merge (handoff section 7.4). Record the
   landing in chain.md and the status file.
6. Then STOP. Do not start the next build. If a hard stop or a question for Josh blocks landing, write it in the status
   file's Questions section (plain text, full question, options, recommendation), push, and end. If the status file
   already holds questions with NO recorded answer, change nothing and end at once, saying so: Josh answers through the
   chat session or the Command Center dashboard, which record the answers in the status file.

### Grant

None. Production is the Mac mini; build sessions never touch it, its database or the real kanban folder (handoff 7.5).
No real outside calls (use stubs). No real email, ever. No production grant is needed: migrations land with the code and
the Mac mini updater (handoff 7.4) applies them.

### Hard stops (wait for Josh)

- A production pre-read or read-back that doesn't match what was committed (not applicable: no production access).
- A failed deploy or smoke check after a merge (the updater does this on the Mac mini, not the build session).
- Any production data write that wasn't granted by name.
- Anything that can't be undone.

### Later rulings (verbatim, with time)

(none yet this build)

## Decided without asking

(filled in during the build)

## Questions

(none)

## Progress

(one line per step, with numbers)

## PICK UP HERE

Start building the CC1 spec. First step after this commit: choose and record the stack in CLAUDE.md, then scaffold the
app shell.
