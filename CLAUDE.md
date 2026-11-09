# CLAUDE.md: Command Center

Rules in working form. Full text and history: docs/process.md (how to build), docs/specs/COMMAND-CENTER-HANDOFF.md
(what to build), docs/claude/chain.md (build order, rulings, what waits on Josh). Keep this file under ~350 lines.

## 1. Project

- **What:** Command Center, one place showing everything Josh Bishop works on (GC jobs from EZ Binder, deals, software
  builds, calendars, email follow-ups, notes, a kanban, phone lookup) for Josh and his wife Christine.
- **Owner:** Josh Bishop, the only human. Contractor, not a programmer: plain words, what a change means for him.
- **Repo:** jsbishop14-art/command-center. Public until the build is complete, then private (Josh, 2026-11-09). Never
  commit secrets, real customer data or anything from the real kanban folder. Plan branch: docs/next-builds.
- **Where it runs:** Josh's Mac mini, always on, plus a touch screen beside it. Reached from outside the home through a
  secure tunnel with login. No hosted website. Builds run in GitHub Codespaces and never touch the Mac mini.
- **Stack:** chosen in CC1 and recorded here with the reason. Constraints: runs 24/7 on macOS (Apple silicon); serves
  a desktop window on the Mac mini and on Josh's Windows PC (over the tunnel) and a full-screen kiosk on the touch
  screen; local database and local kanban folder; no paid hosting.
- **Layout source of truth:** docs/mockup/ (exported from the approved mockup). Bracketed values are placeholders.

## 2. Run protocol

- Branch first. Never edit on main.
- Analyze, then ask all questions at once, then build.
- Unattended runs commit after every step and push the feature branch after every commit.
- One fresh session per build. The status file docs/sessions/<NAME>-status.md is the only memory between sessions.
- A status file with unanswered questions: change nothing and end at once.
- Decide and log (status file, "Decided without asking") when the choice changes none of Josh's rulings, widens no
  access, writes no real data and can be undone. Otherwise table the question and keep doing independent work.

## 3. Landing and production (handoff section 7.5 overrides docs/process.md here)

- **Production is the Mac mini.** Build sessions never touch it, its database, or the real kanban folder.
- **Landing without Josh** when both hold:
  1. CI is green on the branch rebased onto current main (or green with only docs/ or root *.md changed since, listed
     in the merge message with the command used).
  2. Every agreed check passed, with its number stated.
- Process.md's third condition (migrations already on production) does not apply. Migrations land with the code. Each
  migration lists the database objects it should produce, so the Mac mini updater can read them back.
- Merge message starts `[Merge] <NAME> (`. Record the landing in chain.md and the status file.
- Deploy and smoke after merge are done by the Mac mini updater (handoff 7.4), not by the build session.
- One deliberate CI run per build (budget: 1 + 2 infrastructure re-runs + 2 fix runs). Every other push carries
  `[skip ci]`; the pre-push hook enforces it (`git config core.hooksPath scripts/hooks`; ALLOW_CI=1 for the CI push).
- No real outside calls from CI or build sessions: EZ Binder (until Josh confirms S156 live), Gmail, Google Calendar,
  weather, Twilio, FTC, FCC and GitHub are stubbed. No real email, ever.

## 4. Quality rules (docs/process.md section 6)

- Every commit that adds or changes a test states its tally (`unit 14/14`) or says NOT RUN.
- Every new screen or button gets a browser test that signs in as each login and reaches it by clicking from the app's
  own menus. No direct URL. Where it is not for a role, assert the entry point is absent.
- Permission tests state the answer for every role and token (section 7), deny and allow.
- Never judge a result through a pipe or wrapper: read the real exit code, state counts, run a control that must fail.
- Never reformat a file the repo doesn't already format; never apply zero-context patches.
- Measure speed only on a production build.
- Write files with the editor tools, never shell heredocs.
- When a rule changes, find tests of the old rule and invert them.
- Audit by what is actually called, not by name.
- Specs say what the user gets.
- Tech-debt numbers on a branch are `#N-<tag>`, made real at landing.

## 5. Messages and questions

- Short, factual, neutral. No praise, no emotional framing. Plain words.
- Questions in plain text, all at once, in the final message (status file for build sessions). Never the picker:
  ```
  Qn. [NAME-ASK-n] <the question in full; assume no memory>
  Options: A) …  B) …  C) …
  My recommendation: <which, and why in one line>
  ```
- Verify before claiming: git and the database are the facts; say what you checked.
- No dashes in file names of documents sent to Josh.

## 6. Database and storage

- Local database on the Mac mini for everything except the kanban. No tenant id or row security (single household).
- Explicit migrations, each listing its expected objects. Soft delete where data matters. Generated types.
- Kanban cards, pending notes and the kanban log are Markdown/JSONL files in the kanban folder (handoff section 4).
  Only the app writes log lines and assigns card ids.
- Secrets only in the secret store. Never in code, logs, tests or kanban files.

## 7. Roles and permission floors

| Role or token | Can | Cannot |
| --- | --- | --- |
| Josh (login) | Everything | Nothing withheld |
| Christine (login) | Sees everything; uses the app | Edit kanban files directly |
| Claude token (action layer, Sync, chat) | Cards, notes, deals, schedule proposals within handoff 4.7 rule 8 | Move cards to done or discarded, change boards, rewrite card bodies, unless Josh asks in a chat for that change |
| Duet token (action layer) | Same as Claude | Same as Claude; refused entirely when the Duet switch is off |
| Shortcut token | POST /api/phone/lookup, PUT and DELETE /api/phone/mark, POST /api/notes | Every other route |

## 8. Hard limits

- Nothing in the app calls Claude except the Sync button (and Claude in a chat, Duet when Josh uses them). No timers.
- Nudges and any email are Gmail drafts only. The app never sends email.
- No QuickBooks. No editing EZ Binder money records. Schedule moves are proposals until Josh confirms in EZ Binder.
- No Kanban Pro (GoodGuyApps) code, assets or design files.

## 9. References

- docs/claude/chain.md: build order, grants, rulings in force (verbatim, with times), what waits on Josh.
- docs/specs/COMMAND-CENTER-HANDOFF.md: the full requirements (v3).
- docs/specs/<NAME>-BUILD-SPEC.md: one spec per build.
- docs/process.md: the build process, including the build budget (section 12).

Every new Josh ruling goes into the current build's status file and chain.md in the same commit.
