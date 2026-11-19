# CC4 status: note intake, Inbox, Awaiting reply and nudges

Branch: cc4-inbox-email. One fresh unattended session (scripts/run_chain.py). Production is the Mac
mini; this session never touches it (handoff §7.5). No real outside calls; stubs only. No real
email, ever — drafts only.

## RESUME block

Spec §0 (verbatim):

> ## 0. Josh's words (verbatim)
> - 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that
>   session will create the repo and/or anything else needed and start the build"
> - Requirements: handoff 2 (Inbox and Awaiting reply panels), 2.1, 4.4, 7.3. Layout:
>   docs/mockup/Main.dc.html.

Run prompt (verbatim):

> Unattended run in a FRESH session, started by scripts/run_chain.py. Your job is ONLY build CC4.
> 1. Read CLAUDE.md, docs/claude/chain.md and the handoff sections your spec names. If
>    docs/specs/CC4-BUILD-SPEC.md is not on main, bring it from origin/docs/next-builds with your
>    first commit.
> 2. git fetch origin. If origin/cc4-inbox-email exists: check it out, report git status (never
>    discard uncommitted work), read docs/sessions/CC4-status.md and continue from PICK UP HERE.
>    Otherwise create cc4-inbox-email from origin/main and the status file with a RESUME block
>    quoting the spec's section 0 and this prompt verbatim.
> 3. Build docs/specs/CC4-BUILD-SPEC.md per docs/process.md section 4 (decide and log; hard stops
>    only). Commit and push the feature branch after every step. ONE deliberate CI run. Keep a tool
>    call printing output at least every 20 minutes.
> 4. No production grant. Production is Josh's Mac mini, which build sessions never touch (handoff
>    section 7.5). Migrations land with the code and the Mac mini updater applies them. No real
>    outside calls: use the stubs. No real email, ever.
> 5. Land per the landing rule as adapted in CLAUDE.md (handoff section 7.5). The merge commit
>    message MUST start with "[Merge] CC4 (". The Mac mini updater deploys and smoke-checks after
>    the merge (handoff section 7.4). Record the landing in chain.md and the status file.
> 6. Then STOP. Do not start the next build. If a hard stop or a question for Josh blocks landing,
>    write it in the status file's Questions section (plain text, full question, options,
>    recommendation), push, and end. If the status file already holds questions with NO recorded
>    answer, change nothing and end at once, saying so: Josh answers through the chat session or the
>    Command Center dashboard, which record the answers in the status file.

## PICK UP HERE

Step 0 done: branch cc4-inbox-email created from origin/main; CC4 spec brought from
origin/docs/next-builds; this status file written. Building per the plan below.

## Plan (spec §2 scope)

- Migration 0004_inbox_email: tables awaiting_dismissed, intake_seen. Shortcut token hash, intake
  address, Gmail connect state and template B live in app_settings (existing key/value table).
- Gmail stub (src/lib/feeds/gmail.ts): awaiting-reply threads and createDraft only — no send
  function exists anywhere (spec check 1, hard limit §8). Active-job clients stub (clients.ts).
- Intake (src/lib/feeds/intake.ts): poll the intake mailbox stub, create pending notes for new
  email and text-to-email messages, deduped by source_ref (intake_seen). Wired into Refresh.
- Nudge (src/lib/feeds/nudge.ts): fills template B, creates a Gmail draft in the thread. No tokens.
- Shortcut token (src/lib/shortcut.ts): issue/revoke/resolve, hash-only in app_settings, rate
  limited. POST /api/notes accepts the Shortcut token only (handoff §8.7), refused on every other
  route (spec check 2).
- Home Inbox panel + /inbox screen (shared InboxNotes): pending notes with Change, Confirm,
  Dismiss. Nothing becomes a card without Confirm.
- Home Awaiting reply panel (AwaitingReply): flagged threads with No reply needed and Nudge.
- Settings "Inbox & email": connect Gmail, set the intake address, edit template B, Shortcut token.
- iPhone note Shortcut step-by-step guide (docs/).

## Decided without asking (log)

- (recorded as the build proceeds)

## Questions

CC4-ASK-1 is the spec §7 question (intake mailbox). Built configurable per the spec, so it is not a
hard stop; tabled for Josh below.

Q1. [CC4-ASK-1] Which mailbox is the intake address for notes — a new Gmail address, or an alias on
your existing account (josh@worthprop.com)?
Options: A) A new dedicated Gmail address.  B) An alias/plus-address on josh@worthprop.com.
My recommendation: B — a plus-address (e.g. josh+notes@worthprop.com) needs no new account and is
set in Settings → Inbox & email. The field is free text, so either choice works; set it on the Mac
mini after Gmail is connected.
