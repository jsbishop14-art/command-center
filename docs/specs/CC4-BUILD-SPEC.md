# CC4 build spec: note intake, Inbox, Awaiting reply and nudges

## 0. Josh's words (verbatim)

- 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that session will
  create the repo and/or anything else needed and start the build"
- Requirements: handoff 2 (Inbox and Awaiting reply panels), 2.1, 4.4, 7.3. Layout: docs/mockup/Main.dc.html.

## 1. What Josh gets

- Notes he emails to a dedicated intake address, texts to it (carrier text-to-email), or sends from the iPhone note
  Shortcut land in the Home Inbox. Nothing becomes a card until he presses Confirm. Change lets him pick project and
  boards first. Dismiss removes a note without a card.
- Awaiting reply lists Gmail threads where he sent the last message and got no answer: after 2 days, or 1 day for a
  client with an active job. Matching is by recipient email, rule-based, no AI. No reply needed removes that thread
  only. Nudge creates a Gmail draft in the same thread from template B, ending at "Thanks,". Nothing is ever sent.
- A step-by-step guide for building the note Shortcut on his iPhone.
- Settings: connect Gmail, set the intake address, edit template B.

## 2. Scope

Handoff 2 (Inbox, Awaiting reply), 2.1, 4.4 (routes and pending files), 8.7 (POST /api/notes and the Shortcut token,
notes route only), 7.3 rows for Gmail, intake address and the Shortcut. Active-job clients come from EZ Binder in CC6;
until then the 1-day rule uses a stub list.

## 3. Must stay true

- The app never sends email. Drafts only.
- No AI in intake or Awaiting reply.
- The Shortcut token works only on its routes.

## 4. Checks

All checks under "Inbox and email" in handoff section 11, plus:
1. A test asserts no send call exists to the Gmail stub; only draft creation.
2. The Shortcut token is refused on every other route.

## 5. Not in this build

Claude suggestions for notes (CC7). Phone lookup routes (CC10).

## 6. Grant

None.

## 7. Question to table if not answered first

Which mailbox is the intake address (a new Gmail address, or an alias on Josh's account)? Build it configurable.
