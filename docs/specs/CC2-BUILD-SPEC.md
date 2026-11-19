# CC2 build spec: kanban storage and board

## 0. Josh's words (verbatim)

- 2026-11-09 13:10, answers: "1. yes 2. yes 3. yes" (build from scratch; glass theme; kanban stored as Markdown files
  that Claude and Duet can edit).
- 2026-11-09 14:47, on who writes kanban log lines: "i dont follow. you decide" (decided: only the app writes them).
- Requirements: handoff sections 3.1, 3.2, 4 and 5.4. Layout: docs/mockup/Kanban.dc.html.

## 1. What Josh gets

- The full kanban board from the mockup: Inbox, Next, In progress, Waiting on, Done (last 7 days); Business,
  Personal and Family as color tags and filters; project filter; board switcher with J / C / B badges.
- A card panel with stage, area, project, due date, "Show on boards" checkboxes, notes, a history list with names
  (Josh, Christine, Claude, Duet) and Revert on every Claude or Duet change, Discard, and the context file path.
- Quick add (Ctrl K) creates a card on the board he's on.
- Cards live as Markdown files in the kanban folder on the Mac mini, so Claude can update them directly. A hand edit
  shows in the app within 2 seconds. A broken file shows in Problems instead of disappearing.
- Done and discarded cards archive after 30 days; search finds them; restore works.
- The kanban folder is committed to git after changes (hourly when changed; after every Sync once CC7 lands).
- The action layer's card commands, with a separate token each for Claude and Duet (Duet off by default).

## 2. Scope

Handoff 3.1, 3.2, 4.1 to 4.10, 4.8 (card commands and reads only), 5.4 (cards). AGENTS.md and context files.

## 3. Must stay true

- Only the app assigns card ids and writes log lines.
- Claude and Duet limits (handoff 4.7 rule 8) enforced in the action layer and in the watcher's attribution.
- Unknown fields survive a rewrite. Nothing is ever deleted; discard instead.

## 4. Checks

All checks under "Kanban storage" in handoff section 11, plus:
1. Revert restores a Claude or Duet change and is logged; Revert on a card changed again shows both versions first.
2. Claude and Duet tokens cannot move a card to Done or discarded, change boards, or rewrite a body.
3. With the Duet switch off, the Duet token is refused.
4. Browser test reaches the board and a card panel from the menu as each login.

## 5. Not in this build

Sync (CC7), deals (CC5), pending-note intake routes (CC4; the pending/ folder format and Confirm are here).

## 6. Grant

None.
