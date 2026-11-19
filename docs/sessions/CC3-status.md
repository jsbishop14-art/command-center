# CC3 status — Home screen, calendars, weather and Refresh

Branch: cc3-home. Spec: docs/specs/CC3-BUILD-SPEC.md. Handoff sections: 2 (top bar, panels), 5.2, 7.3.

## RESUME

Spec section 0 (Josh's words, verbatim):

- 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that session will
  create the repo and/or anything else needed and start the build"
- Requirements: handoff section 2 (top bar, Today and Kanban panels), 5.2, 7.3. Layout: docs/mockup/Main.dc.html.

Run prompt (verbatim):

> Unattended run in a FRESH session, started by scripts/run_chain.py. Your job is ONLY build CC3.
> 1. Read CLAUDE.md, docs/claude/chain.md and the handoff sections your spec names. If docs/specs/CC3-BUILD-SPEC.md is not on main, bring it
>    from origin/docs/next-builds with your first commit.
> 2. git fetch origin. If origin/cc3-home exists: check it out, report git status (never discard uncommitted work), read
>    docs/sessions/CC3-status.md and continue from PICK UP HERE. Otherwise create cc3-home from origin/main and the
>    status file with a RESUME block quoting the spec's section 0 and this prompt verbatim.
> 3. Build docs/specs/CC3-BUILD-SPEC.md per docs/process.md section 4 (decide and log; hard stops only). Commit and push the feature branch
>    after every step. ONE deliberate CI run. Keep a tool call printing output at least every 20 minutes.
> 4. No production grant. Production is Josh's Mac mini, which build sessions never touch (handoff section 7.5). Migrations land with the code and the Mac mini updater applies them. No real outside calls: use the stubs. No real email, ever.
> 5. Land per the landing rule as adapted in CLAUDE.md (handoff section 7.5). The merge commit message MUST start with
>    "[Merge] CC3 (". The Mac mini updater deploys and smoke-checks after the merge (handoff section 7.4). Record the
>    landing in chain.md and the status file.
> 6. Then STOP. Do not start the next build. If a hard stop or a question for Josh blocks landing, write it in the status
>    file's Questions section (plain text, full question, options, recommendation), push, and end. If the status file
>    already holds questions with NO recorded answer, change nothing and end at once, saying so: Josh answers through the
>    chat session or the Command Center dashboard, which record the answers in the status file.

## PICK UP HERE

Step 1 done: branch cc3-home created from origin/main; spec brought from origin/docs/next-builds; status file written; pre-push hook path set. Building the data layer next.

## Decided without asking

(filled as the build proceeds)

## Questions

None.
