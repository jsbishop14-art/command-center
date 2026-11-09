# CC5 build spec: deals, contacts and the Projects grid

## 0. Josh's words (verbatim)

- 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that session will
  create the repo and/or anything else needed and start the build"
- Requirements: handoff 2 (Projects), 3.3, 3.4, 4.8 (deal commands), 5.4 (deals). Layout: docs/mockup/Deals.dc.html,
  Contacts.dc.html, Main.dc.html.

## 1. What Josh gets

- A Deals screen with Sale and Development types and their stages, open and archived views, a deal panel (stage,
  value, probability, current task, next action and date, EZ Binder customer, linked estimates, EZ Binder job once
  Won, contacts, boards, history with Revert, Archive).
- The five seed deals: BNT / ES Windows pool, Ohio affordable housing (two sites), Best Western Naples, 33406 (48
  units), NeighborLee Living.
- A Contacts screen for lenders, partners and others, with several emails each and linked deals. Awaiting reply and
  the Inbox use these emails for matching.
- The Projects grid on Home with filters All, Deals, GC jobs, Software, Personal and Family.
- Deal commands in the action layer, so Claude and Duet change deals only through it.

## 2. Scope

Handoff 2 (Projects grid), 3.3, 3.4, 4.8 (update deal, read deal), 5.4 (deal Revert). EZ Binder estimate status and
GC job cards use the stub until CC6. Software cards show "Coming in CC8".

## 3. Must stay true

- Claude and Duet never change deals in the database directly.
- Archived deals are hidden from Projects and found by search.

## 4. Checks

1. Browser test as each login reaches Deals and Contacts from the menu.
2. Deal history shows Claude and Duet changes with Revert; Revert restores the earlier values.
3. A contact's second email matches an Awaiting reply thread to the right deal.
4. Seed deals present after a fresh install.
5. Board toggle filters deals by their boards list.

## 5. Not in this build

Live EZ Binder data (CC6).

## 6. Grant

None.
