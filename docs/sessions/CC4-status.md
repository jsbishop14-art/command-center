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

LANDED 2026-11-19. CC4 is complete and merged to main. Nothing more to do in this session; the Mac
mini updater deploys and smoke-checks after the merge (handoff §7.4). See "Landing" below.

Step 0 done: branch cc4-inbox-email created from origin/main; CC4 spec brought from
origin/docs/next-builds; this status file written. Building per the plan below.

## Landing

- CI green: run 44462137720, both jobs (Lint/types/build/unit: success; Browser tests: success).
- Branch fast-forwardable onto main (0 behind). After the CI-green commit c971679 the only commits
  are docs (chain.md + CC4-status.md), listed in the merge message, via git merge --no-ff.
- Merge into main with a message starting "[Merge] CC4 (". Landing recorded in chain.md.
- Migration 0004_inbox_email lands with the code; the Mac mini updater applies it — expected
  objects: awaiting_dismissed, intake_seen.
- Waits on Josh (also in chain.md): connect Gmail and set the intake address in Settings → Inbox &
  email, issue the iPhone Shortcut token, build the note Shortcut from
  docs/guides/iphone_note_shortcut.md, and answer CC4-ASK-1 below.

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

These changed none of Josh's rulings, widened no access, wrote no real data, and are reversible.

- Settings beyond inbox/email tables go in app_settings (existing key/value table): the Shortcut
  token hash, intake address, Gmail connect time, and template B. Migration 0004 adds only two
  tables (awaiting_dismissed, intake_seen). Less surface, same behaviour.
- The Shortcut token is stored hash-only in app_settings (like the action-layer tokens), shown once
  at issue, with a per-process rate limit (handoff §8.7 "rate limited"). Not in the Keys list.
- POST /api/notes accepts the Shortcut token ONLY — not the interactive login, not a Claude/Duet
  token (handoff §8.7 wording "instead of the interactive login"; roles §7). Enforced both ways.
- The left-menu "Inbox (count)" is a real /inbox screen showing the same pending notes as the Home
  Inbox panel (shared component), with a plain count badge (red counts are Builds only, §2).
- Awaiting reply and the intake poll only run once Gmail is connected; until then both panels show
  "connect Gmail in Settings". The Inbox still lists Shortcut notes without Gmail.
- The nudge button only acts on a thread currently in Awaiting reply; it never sends, only drafts.
- iPhone note Shortcut guide: docs/guides/iphone_note_shortcut.md (underscores, no dashes per §5).

## Tallies and checks (evidence)

- unit 86/86 (`npm run test:unit`); migrations 3/3 read back (0004 expects awaiting_dismissed,
  intake_seen). browser 38/38 (`npm run test:e2e`), 14 new in cc4-*.
- Spec §4 check 1 (no Gmail send; drafts only): unit "the Gmail stub exposes draft creation and NO
  send function" + source scan; e2e cc4-awaiting "Nudge … and sends nothing".
- Spec §4 check 2 (Shortcut token refused on every other route): unit "the Shortcut token is not an
  action-layer token, and vice versa"; e2e cc4-api-shortcut "refused on the action-layer route" and
  permissions.e2e "POST /api/notes … refuses without a Shortcut token".
- Handoff §11 Inbox & email: notes never file without confirmation + Dismiss (kanban-actions.test,
  cc4-inbox.e2e); notes arrive from email, text-to-email and the Shortcut (cc4-inbox.test intake +
  cc4-api-shortcut.e2e); Awaiting flags at 2 days / 1 day for active clients, No reply needed
  removes only that thread (cc4-inbox-email.test, cc4-awaiting.e2e); Nudge drafts template B ending
  "Thanks," and sends nothing (cc4-inbox-email.test, cc4-awaiting.e2e).
- CLAUDE §4 inverted test: permissions.e2e "POST /api/notes exists in CC4 and refuses without a
  Shortcut token" replaces the CC1 assertion that /api/notes 404s.

## Questions

CC4-ASK-1 is the spec §7 question (intake mailbox). Built configurable per the spec, so it is not a
hard stop; tabled for Josh below.

Q1. [CC4-ASK-1] Which mailbox is the intake address for notes — a new Gmail address, or an alias on
your existing account (josh@worthprop.com)?
Options: A) A new dedicated Gmail address.  B) An alias/plus-address on josh@worthprop.com.
My recommendation: B — a plus-address (e.g. josh+notes@worthprop.com) needs no new account and is
set in Settings → Inbox & email. The field is free text, so either choice works; set it on the Mac
mini after Gmail is connected.
