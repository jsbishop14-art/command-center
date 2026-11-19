# CC5 status: deals, contacts and the Projects grid

Branch: cc5-deals-contacts. Spec: docs/specs/CC5-BUILD-SPEC.md. Handoff sections: 2 (Projects), 3.3,
3.4, 4.8 (update deal, read deal), 5.4 (deal Revert). Layout: docs/mockup/Deals.dc.html,
Contacts.dc.html, Main.dc.html.

## RESUME block

Spec §0 (Josh's words, verbatim):

- 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that
  session will create the repo and/or anything else needed and start the build"
- Requirements: handoff 2 (Projects), 3.3, 3.4, 4.8 (deal commands), 5.4 (deals). Layout:
  docs/mockup/Deals.dc.html, Contacts.dc.html, Main.dc.html.

Run prompt (verbatim):

> Unattended run in a FRESH session, started by scripts/run_chain.py. Your job is ONLY build CC5.
> 1. Read CLAUDE.md, docs/claude/chain.md and the handoff sections your spec names. If
>    docs/specs/CC5-BUILD-SPEC.md is not on main, bring it from origin/docs/next-builds with your
>    first commit.
> 2. git fetch origin. If origin/cc5-deals-contacts exists: check it out, report git status (never
>    discard uncommitted work), read docs/sessions/CC5-status.md and continue from PICK UP HERE.
>    Otherwise create cc5-deals-contacts from origin/main and the status file with a RESUME block
>    quoting the spec's section 0 and this prompt verbatim.
> 3. Build docs/specs/CC5-BUILD-SPEC.md per docs/process.md section 4 (decide and log; hard stops
>    only). Commit and push the feature branch after every step. ONE deliberate CI run. Keep a tool
>    call printing output at least every 20 minutes.
> 4. No production grant. Production is Josh's Mac mini, which build sessions never touch (handoff
>    section 7.5). Migrations land with the code and the Mac mini updater applies them. No real
>    outside calls: use the stubs. No real email, ever.
> 5. Land per the landing rule as adapted in CLAUDE.md (handoff section 7.5). The merge commit
>    message MUST start with "[Merge] CC5 (". The Mac mini updater deploys and smoke-checks after
>    the merge (handoff section 7.4). Record the landing in chain.md and the status file.
> 6. Then STOP. Do not start the next build. If a hard stop or a question for Josh blocks landing,
>    write it in the status file's Questions section (plain text, full question, options,
>    recommendation), push, and end. If the status file already holds questions with NO recorded
>    answer, change nothing and end at once, saying so.

## PICK UP HERE

Fresh start: branch created from origin/main; origin/cc5-deals-contacts did not exist. Spec brought
from origin/docs/next-builds in the first commit. Building the steps below in order.

## Plan (commit + push after each step; one deliberate CI run near the end)

1. Spec + this status file.
2. Migration 0005_deals_contacts; generated types; migration test extended.
3. Deals/contacts library: types, store, action layer (update_deal, read_deal), history + Revert,
   EZ Binder estimate stub, GC jobs stub, seed (five deals + a few contacts). Unit tests.
4. Awaiting-reply matching by a contact's emails to its linked deal; inbox-view wiring. Unit test
   (spec check 3).
5. UI: Deals screen, Contacts screen, server actions, nav wiring, Projects grid on Home, CSS.
   Browser tests (checks 1, 2, 5) + global-setup wiring.
6. Deliberate CI run; land.

## Agreed checks (spec §4)

1. Browser test as each login reaches Deals and Contacts from the menu.
2. Deal history shows Claude and Duet changes with Revert; Revert restores the earlier values.
3. A contact's second email matches an Awaiting reply thread to the right deal.
4. Seed deals present after a fresh install.
5. Board toggle filters deals by their boards list.

## Must stay true (spec §3)

- Claude and Duet never change deals in the database directly (always the action layer, handoff 4.8).
- Archived deals are hidden from Projects and found by search.

## Decided without asking

(none yet)

## Questions

(none)
