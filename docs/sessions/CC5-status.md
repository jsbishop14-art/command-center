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

Steps 1-5 built, committed and pushed. Local: unit 103/103, browser 46/46; typecheck and lint
clean; production build OK. Branch 0 behind origin/main (fast-forwardable). Next: one deliberate CI
run, then land. If resuming after the CI run, check the run result and land per the rule below.

Fresh start: branch created from origin/main; origin/cc5-deals-contacts did not exist. Spec brought
from origin/docs/next-builds in the first commit.

## Check evidence (spec §4)

1. Each login reaches Deals and Contacts from the menu — browser cc5-deals-contacts.e2e.ts
   "check 1: josh/christine reaches Deals and Contacts from the menu" (clicks the left-menu links;
   no direct URL).
2. Deal history shows Claude/Duet changes with Revert; Revert restores earlier values — browser
   cc5-deals-contacts.e2e.ts "check 2" (reverts a seeded Claude change on BNT, restores the seed
   next action) + unit cc5-deals.test.ts "history and Revert" (before/after, revert line attributed,
   not-revertable for Josh, changed_again path).
3. A contact's second email matches an Awaiting reply thread to the right deal — unit
   cc5-deals.test.ts "Awaiting reply matches a thread to the right deal by a contact's second email"
   (joe@sparkelectric.com is Joe Abrams' second address → BNT) and "email matching" tests. See
   Decided-without-asking on why this check is unit-only in the browser.
4. Seed deals present after a fresh install — unit cc5-deals.test.ts "the five seed deals are
   present" + browser reach in check 1 (Josh's board shows them).
5. Board toggle filters deals by their boards list — browser cc5-deals-contacts.e2e.ts "check 5"
   (Bishops shows only Ohio + 33406; Christine shows none).

Action-layer deal commands (handoff §4.8, CLAUDE §7 token map): browser cc5-api-deal.e2e.ts — Claude
token can read_deal/update_deal (allow), invalid stage rejected (400), Duet token refused while the
switch is off (403 duet_off). No-token/Shortcut refusal on /api/action covered by existing
kanban-tokens + permissions e2e. Migration 0005_deals_contacts expected objects verified by unit
migrations.test.ts.

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

- Spec check 3 (contact second email → deal match) is proven by unit tests, not a browser test. The
  only deal-matchable flagged Awaiting-reply thread in the stub is t-spark (joe@sparkelectric.com →
  Joe Abrams → BNT); the CC4 browser test cc4-awaiting dismisses t-spark ("No reply needed") in the
  shared e2e database, and the CC4 unit test pins the flagged set to exactly [t-spark, t-riverwood],
  so neither aging a thread nor adding one can give CC5 its own browser-visible deal-matched thread
  without inverting a landed CC4 check. The matching is a label on the existing Awaiting panel (not a
  new screen or button), so CLAUDE §4's browser-test rule does not require it; the unit test is the
  authoritative evidence for check 3. Changes none of Josh's rulings, widens no access, writes no
  real data, reversible.
- Deals store boards as a JSON array column and are filtered in code (like kanban cards), rather than
  a join table. GC jobs and EZ Binder estimate status use local stubs until CC6 (spec §2); the live
  path returns nothing until EZ Binder is wired, so no real outside call happens in CI or a build
  session. Software projects show "Coming in CC8"; Personal/Family is a present but empty filter in
  CC5.
- Seeded three/four contacts (Joe Abrams, Marcus Reed, Priya Shah, Tile Warehouse) linked to deals so
  the Contacts screen and the matching have realistic data on a fresh install. Deal/contact names are
  Josh's and already appear in the committed spec and mockup; no customer data beyond that is stored.

## Questions

(none)
