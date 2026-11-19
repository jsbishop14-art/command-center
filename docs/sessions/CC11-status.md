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

Step 1 done (this commit): status file, chain.md rulings, CC3/CC4/EZB asks marked answered. Next: step 2 (Google
OAuth lib + migration 0010).

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
