# Command Center Build Handoff v3

Nov 9, 2026 · @Josh

## Changes from v2

v3 replaces v2 (2026-11-09) and folds in the Kanban Pro Audit and the Kanban Markdown Storage Handoff (both 2026-11-09). All open questions from v2 are answered. Follow docs/process.md (the build process, in this repo) for how to build; this document says what to build. Ask Josh what, never how. Section 7.5 lists where process.md is adapted for this project.

- Built from scratch. Kanban Pro (GoodGuyApps) is proprietary and cannot be used: no copied code, assets or design files. No open-source base. Nimbalyst was not audited.
- Glass theme on every screen as an original design: light glass on desktop screens, dark glass on the touch screen. The mockup is already glass.
- Kanban cards are Markdown files, not database rows (§4). Deals and everything else stay in the database.
- AI is limited to the Sync button (no scheduled runs), Claude in a chat, and Duet (§5). Rewrite with Claude is removed. Awaiting reply matching is rule-based.
- Revert button on every change Claude or Duet makes.
- The app writes every kanban log line itself, including for changes Claude makes directly in the files. Writers mark their edits with last_actor and last_run (§4.6).
- Refresh button (no AI) pulls new data on demand.
- Schedule proposals come from three sources: Josh dragging dates, a fixed rule, and Claude.
- Contacts list for lenders and partners.
- Weather uses the saved zip only (33472, editable). No location services.
- Phone lookup is built last (Phase 10).
- Mobile, including phone location, is held until the build is complete.
- Build tracking follows process.md: builds run in GitHub Codespaces, and the Builds screen reads their status from GitHub. Stages are Queued, Building, Needs Josh and Landed (§7.1).
- Josh answers build questions on the dashboard; the answer is written into the build's status file on GitHub (§7.1).
- Build budget tile defined (§7.1), with the budget added to process.md section 12.
- After each Command Center build lands, the Mac mini updates itself, runs a smoke check and rolls back on failure (§7.4).

## Sources

- Mockup, the source of truth for layout: https://claude.ai/artifact/SGithSy384wLKKjKACG8Bf. Bracketed values in it are placeholders. It has no Phone lookup screen; §8.6 describes that layout.
- EZ Binder contract: "EZ Binder API for Command Center: handoff" (2026-10-23, EZ Binder build S156). It governs every EZ Binder call. Build against a stub until Josh confirms S156 is live.

## Superseded

- v1 and v2 of this handoff.
- The draft "EZ Binder API Spec for Command Center".
- The standalone "Phone Lookup Spec".
- The Kanban Markdown Storage Handoff, which is folded into §4.

## 1. What it is, platform and boards

Command Center is one place that shows everything Josh is working on: GC jobs (from EZ Binder), deals, software builds, calendars, email follow-ups, notes and a kanban, for Josh and his wife Christine. It includes a phone number lookup that flags telemarketers before Josh calls a number back. It runs locally on Josh's Mac mini (on 24/7), with a touch screen next to it as an always-on display.

### 1.1 Platform and access

| Item | Decision |
|---|---|
| Host | Mac mini, always on. App, database, kanban files, Sync, data jobs and webhook receiver all run there |
| Form | Locally hosted desktop software, not a hosted website. A desktop window on the Mac mini and on Josh's Windows PC |
| Windows PC | Reads and writes everything, kanban included, through the app over the tunnel. Never through a shared folder |
| Remote access | Reachable outside the home network through a secure tunnel, login required. Also needed for EZ Binder webhooks, the Duet connection and the iPhone lookup Shortcut |
| Users | Josh and Christine, separate logins. Christine sees everything |
| Christine | Uses the app only. She does not edit kanban files directly |
| Touch screen | Connected to the Mac mini, full-screen kiosk mode, swipe between screens (§6) |
| Theme | Glass, original design. Light glass on desktop screens, dark glass on the touch screen |
| Mobile | Held until the build is complete. Keep the layout able to collapse to phone width later. The iPhone lookup Shortcut (§8.7) is the only phone access in this build |
| Builds | Software builds run in GitHub Codespaces under docs/process.md, not on the Mac mini. Command Center reads their status from GitHub (§7.1) |
| Updates | Command Center updates itself on the Mac mini after each of its own builds lands (§7.4) |
| Secrets | EZ Binder API key, webhook signing secret, Twilio SID and token, FTC (api.data.gov) key, FCC app token, Duet access token, the Shortcut token and a GitHub token (§7.1), all in a secret store, never in code, logs or kanban files |

### 1.2 Data storage

| Data | Where |
|---|---|
| Kanban cards, pending notes, kanban activity log | Markdown and JSONL files in the kanban folder (§4) |
| Deals, contacts, cached EZ Binder data, calendars, email state, usage log, phone lookup data, settings | Local database on the Mac mini |

### 1.3 Boards

- Three boards: Josh, Christine, Bishops (shared household).
- Cards, pending notes and deals each carry a boards list. An item shows on every board in its list ("Show on boards" checkboxes).
- The board toggle in the top bar switches everything on the screen to that board's data. Phone lookup is not board-scoped (§8.8).
- Quick add and new items default to the board the user is currently on.

## 2. Home screen

Top bar:

- Date.
- Weather: temperature, conditions, rain chance, high/low. Uses the saved zip, default 33472, editable in Settings.
- Search.
- Refresh, with no AI (§5.2).
- Sync with Claude (§5.1).
- Notification bell with a red count of builds needing Josh; it opens Builds.
- Quick add (Ctrl K).
- Board toggle.

Left menu: Home, Projects, Kanban, Inbox (count), Calendar, Schedule, Deals, Contacts, Builds (red "need you" count), Money, Phone lookup, live feed status list, Problems (count, §4.9), Settings.

Body, top to bottom:

1. Money tiles (EZ Binder GET /summary/ar): open A/R, received this week, open invoices, over 30 days.
2. Four panels, fixed height, scrolling inside, each with a drag handle (reorder) and a collapse arrow. Panel order and collapsed state are saved per user.
  - Today: events from three Google calendars (Christine personal, Josh work, Josh personal), colored by person, plus kanban cards due today.
  - Inbox: pending notes (§4.4). Each note shows Claude's suggested project and board from the last Sync, with Change, Confirm and Dismiss. Notes that arrived after the last Sync show "Not sorted yet"; Josh can file them by hand. Nothing becomes a card without Josh's confirmation.
  - Awaiting reply: Gmail threads where Josh sent the last message and got no answer. Flag after 2 days, or 1 day if the recipient is a client with an active job (EZ Binder GET /customers?has_active_job=true and /customers/lookup). Rule-based, no AI. The thread is matched to a project or deal by recipient email: EZ Binder customers, the Contacts list (§3.4) and deal links. Buttons:
    - No reply needed removes that thread only, not future emails in it.
    - Nudge opens a Gmail draft in the same thread from template B (§2.1). No tokens.
  - Kanban, in progress: in-progress cards for the current board, with a link to the full board.
3. Projects: card grid with filters All, Deals, GC jobs, Software, Personal and Family. Each card shows group, source, name, status, Now (current task), Next, Due and Money.
  - GC jobs: from EZ Binder, grouped by computed phase (sold not started, active, punch). Now/Next = today_task / next_task. Money = billed/paid from EZ Binder.
  - Deals: from Command Center (§3.3), with the linked estimates' status from EZ Binder.
  - Software: from build status on GitHub (§7.1). Now = the build in progress, Next = the next queued build.
4. GC schedule, next 2 weeks: EZ Binder GET /schedule, one row per job, active and sold-not-started jobs, with a color legend. Proposed moves show as dashed "Proposed, confirm in EZ Binder" bars (§2.2).

### 2.1 Nudge template

Template B. The bracketed fields fill automatically. The body ends at "Thanks," with no name, because Gmail adds Josh's signature. The draft is created in Gmail and never sent by the app.

> Hi [first name], checking in on the below. Is there anything you need from me to move this forward? Thanks,

The template text is editable in Settings.

### 2.2 Schedule proposals

Proposals come from three sources. None of them changes EZ Binder until Josh confirms the move in EZ Binder.

| Source | How | AI |
|---|---|---|
| Josh | Drags a job's or task's dates on the GC schedule. The app sends the move to EZ Binder as a proposal | No |
| Slip rule | When a task passes its end date without being completed, propose shifting the later tasks on that job by the same number of days. Ordinary code; runs whenever schedule data refreshes | No |
| Claude | During Sync (item "Schedule proposals") or when asked in a chat, through the action layer (§4.8) | Yes |

- Each proposal shows its source ("Proposed by Josh", "Proposed by rule", "Proposed by Claude").
- A rule proposal is not repeated for the same task once it has been confirmed or rejected.
- Check the S156 contract: v2 had only Claude moves returning 202 as proposals. Confirm the API accepts proposals from Josh and from the rule, using X-EZB-Actor values josh and rule. If it does not, raise it with Josh before building this.

## 3. Kanban, deals and contacts

### 3.1 Kanban board

- Stages: Inbox, Next, In progress, Waiting on, Done. Done shows the last 7 days.
- Business, Personal and Family are color tags and filters, not lanes. Cards can also be filtered by project.
- A board switcher (Josh, Christine, Bishops). J / C / B badges on each card show which boards it is on.
- Card detail panel:
  - Fields: stage, area, project, due date, "Show on boards" checkboxes and notes.
  - A history panel built from the activity log (§4.6).
- Named members: Josh, Christine, Claude and Duet each show by name, with a small avatar, wherever a change is attributed. Cards created or moved by Claude or Duet show "Added by Claude" (or Duet) with the time.
- Revert: every change made by Claude or Duet has a Revert button in the history panel and on the Sync results list (§5.4).
- Discarded cards (§4.3) are hidden from the board and appear in search.

### 3.2 Card context file

For each card, the app generates a short context file that Claude reads before working on that card. The file holds:

- The card's fields and notes.
- Its project and the linked deal or EZ Binder job summary.
- The last 10 history lines.
- A pointer to AGENTS.md.

The file is regenerated whenever the card or its linked data changes. It lives at kanban/context/<card id>.md, is generated only, and is never edited by hand.

### 3.3 Deals

EZ Binder does not hold deals. Command Center stores them in its database.

- Fields: name, type, stage, value, probability, next action, next action date, current task, notes, boards, customer_id, linked estimate_ids, job_id once won, and linked contacts.
- Type and stages:

| Type | Stages |
|---|---|
| Sale | Lead, Estimating, Proposal sent, Negotiating, Won, Lost |
| Development | Due diligence, Entitlement, Financing, Closing |

- Estimates: Josh links specific estimates to each deal. Several are allowed. Deal cards show each linked estimate's status and total from EZ Binder (GET /estimates/{id}), refreshed on estimate.updated.
- Archive: a deal that ends (Won, Lost, or a development deal that closes or stops) can be archived. Archived deals are hidden from Projects and appear in search.
- Seed deals:
  - BNT / ES Windows pool
  - Ohio affordable housing (two sites)
  - Best Western Naples
  - 33406 (48 units)
  - NeighborLee Living
- Deals are changed through the app UI or through the action layer (§4.8), never directly in the database by Claude or Duet.

### 3.4 Contacts

A contacts list for lenders, partners and others who are not EZ Binder customers.

- Fields: name, company, role (lender, partner, other), email addresses (several), phone, linked deals and notes.
- Used by: Awaiting reply matching, the Claude inbox suggestions and deal pages.
- EZ Binder customers are not copied here. They are looked up live.

## 4. Kanban storage

Kanban cards and pending notes are plain Markdown files with YAML frontmatter on the Mac mini. The app, Claude and Duet read and write the same files. There is no database table for cards. Writers that can reach the folder on the Mac mini edit files directly. Writers that can't reach it use the action layer (§4.8), which writes the same files.

### 4.1 Folder layout

The folder sits at a fixed local path on the Mac mini, set in Settings. It must be outside iCloud, Dropbox and OneDrive, because sync clients create conflict copies.

```text
CommandCenter/kanban/
  board.yaml            Config: schema version, stages, areas, boards, projects
  AGENTS.md             Rules for Claude and Duet (generated by the app)
  new/                  New cards from Claude or Duet, without an id yet
  cards/                One file per card, all boards together
    CC-0001.md
  pending/              Notes from email, text or Shortcut waiting for Josh (not cards yet)
    N-0001.md
  attachments/          Files and photos, one folder per card or note id
    CC-0001/
  context/              Generated context file per card (§3.2)
  archive/2026/         Done and discarded cards older than 30 days
  log/2026-11.jsonl     Append-only activity log, one file per month
```

Cards are not split into per-board or per-stage folders, because one card can show on several boards. Board and stage are fields in the card.

### 4.2 Card file

The file name is the card id plus .md, for example CC-0042.md.

```markdown
---
id: CC-0042
title: Ohio sites presentation
stage: in_progress
boards: [josh]
area: business
project: ohio-affordable-housing
due: 2026-11-14
order: 3000
created: 2026-11-09T13:20:00-05:00
updated: 2026-11-09T13:20:00-05:00
created_by: josh
source: manual
source_ref:
waiting_on:
waiting_since:
done_at:
discarded_at:
last_actor: josh
last_run:
---

Notes in plain Markdown.
```

| Field | Required | Values |
|---|---|---|
| id | yes | CC- plus 4 or more digits, matching the file name |
| title | yes | Text. Quoted when it holds a colon |
| stage | yes | inbox, next, in_progress, waiting_on, done, discarded |
| boards | yes | One or more of josh, christine, bishops |
| area | yes | business, personal, family (filter tag) |
| project | no | Project slug from board.yaml |
| due | no | Date (YYYY-MM-DD) |
| order | yes | Spaced numbers (1000, 2000, 3000) for the sort position within the stage column. A drag takes a number between its neighbors. Only the app renumbers a column, when the gaps run out |
| created, updated | yes | Timestamp with time zone (America/New_York) |
| created_by | yes | josh, christine, claude, duet |
| source | yes | manual, email, sms, shortcut, claude_chat, sync, ezbinder |
| source_ref | no | Email message id, EZ Binder record id, and so on. Used to prevent duplicates (§4.7) |
| waiting_on | when stage is waiting_on | Person or item |
| waiting_since | when stage is waiting_on | Date |
| done_at | when stage is done | Timestamp |
| discarded_at | when stage is discarded | Timestamp |
| last_actor | yes | josh, christine, claude, duet. Who made the latest change. Set by every writer on every change (§4.6) |
| last_run | no | Run id of the latest change (§4.6). Empty for Josh and Christine |

- The body holds free Markdown notes, shown in the card detail panel. Attachments are linked from the body as attachments/CC-0042/<file name>.
- discarded is for mistakes and duplicates. It is hidden from boards, logged, and archived after 30 days like Done.

### 4.3 Card ids and new cards

- Only the app assigns ids, in sequence.
- Claude and Duet create a card by writing a file without an id into new/. The file name can be anything ending in .md.
- The app picks up each file in new/ within a second. It assigns the next id, moves the file into cards/ and logs create.
- A file in new/ that fails validation goes to the Problems view (§4.9).

### 4.4 Pending notes

Notes land in pending/ and appear in the Home Inbox panel. They become cards only when Josh confirms.

Intake routes, all ordinary code:

- An email to a dedicated intake address.
- A text sent to that address through the carrier's free text-to-email.
- An iPhone Shortcut that posts to POST /api/notes, using the Shortcut token. The token's scope covers this route plus the phone lookup routes (§8.7).

```markdown
---
id: N-0001
via: email
received: 2026-11-09T09:12:00-05:00
source_ref: <gmail message id>
suggested_project: bnt-es-windows-pool
boards: [josh]
suggested_at: 2026-11-09T12:00:00-05:00
suggested_by: claude
---

Follow up with ES rep on pooled order
```

- via: email, sms, or shortcut.
- boards starts as the suggested boards. Josh can change it.
- Attachments go to attachments/N-0001/.
- Confirm: the app creates a card in cards/ with stage inbox. It moves the attachments to the card's folder, logs confirm_note, then deletes the pending file.
- Change: Josh picks the project and boards before confirming.
- Dismiss: deletes the pending file without making a card, and logs note_dismissed.

### 4.5 board.yaml

```yaml
schema: 1
stages: [inbox, next, in_progress, waiting_on, done, discarded]
boards:
  josh: { name: Josh }
  christine: { name: Christine }
  bishops: { name: Bishops }
areas: [business, personal, family]
projects:            # generated by the app; do not edit by hand
  - slug: ohio-affordable-housing
    name: Ohio affordable housing
    group: deal
    deal_id: <id>
  - slug: riverwood
    name: Riverwood
    group: gc_job
    ezbinder_id: <id>
```

- The app regenerates projects from EZ Binder jobs, deals and the software builds list.
- schema is raised when the file format changes. The app migrates older files on load.

### 4.6 Activity log

Every change by any writer gets one line in log/<YYYY-MM>.jsonl. A line holds the values before and after the change, so any change can be reverted.

Only the app writes log lines. Other writers never append to the log:

- The app keeps a snapshot of the last version of every card file it has seen. This snapshot is a cache for computing changes, not the source of truth.
- Changes made through the app UI or the action layer are logged by the app as it makes them.
- Changes made directly in a file (Claude on the Mac mini, or anyone editing by hand) are logged when the folder watcher sees them. The app compares the file with its snapshot and writes the line with the before and after values, using the file's last_actor and last_run.
- Cards created in new/ are logged as create, with actor from created_by.
- If a direct file change did not update last_actor, it is logged with actor unknown and still shows in the card's history with Revert.
- The app updates its snapshot after writing each line.

Example line:

```json
{"id":"L-2026-11-000123","at":"2026-11-09T13:25:00-05:00","actor":"claude","card":"CC-0042","action":"move","before":{"stage":"next","order":2000},"after":{"stage":"in_progress","order":3000},"run":"sync-2026-11-09-1204"}
```

- Card actions: create, edit, move, board_add, board_remove, discard, archive, restore, revert.
- Note actions: note_received, note_suggested, note_dismissed, confirm_note.
- Run ids:
  - sync-<date>-<time> for Sync.
  - chat-<date>-<time> for Claude in a chat.
  - duet-<date>-<time> for Duet.
  - Empty for Josh and Christine.
- A revert line names the log id it undoes.
- Each line is written in one append and stays under 4 KB.

### 4.7 Rules for every writer

1. Write atomically. Write to a temp file in the same folder, then rename it over the card.
2. Set updated on every change. Before writing, re-read the file. If updated changed since it was read, re-apply the change to the current version instead of overwriting.
3. Never delete a card. Use discarded. Done and discarded cards stay in cards/ for 30 days; then the app moves them to archive/YYYY/.
4. Set last_actor and last_run on every change. Do not write to the log; the app logs every change (§4.6).
5. Claude edits happen inside a Sync run or in a chat when Josh asks. Never on a timer or constant checks.
6. Keep unknown fields as they are when rewriting a file.
7. Before creating a card from an email, note or EZ Binder change, check source_ref against cards/, new/ and archive/. Skip it if it already exists.
8. Limits on Claude and Duet:
   - No moves to done or discarded.
   - No changes to boards.
   - Card bodies are append only, never rewritten.
   - In a chat, Claude may go past these limits only when Josh asks for that specific change.

### 4.8 Action layer

The action layer is a set of commands the app carries out. Each command writes the same files, database rows and log lines as the UI.

Commands:

- Cards: add card, update card, move card, append note.
- Notes: file note, suggest note.
- Deals: update deal.
- Schedule: propose schedule move.
- Reads: read card, list cards, read deal.

Used by:

- Duet.
- Claude in a chat from any computer other than the Mac mini.
- Sync, for deals and schedule proposals.
- Any writer changing deals. Deals always go through the action layer.

Access:

- It is reached through the tunnel with a token per writer: Claude and Duet each get their own.
- Each token is revocable in Settings.
- The Duet on/off switch in Settings disables Duet's token. Whether Duet can connect to a self-hosted endpoint is still unconfirmed, so build Duet support behind that switch.

### 4.9 App behavior

- Watches the kanban folder and reloads a card when its file changes. It ignores watch events for files it just wrote, and waits about 300 ms after a change before reloading.
- Writes the activity log line for every change it sees in a file, from its snapshot of the previous version (§4.6).
- Validates frontmatter on load. A file that fails is not dropped: it is listed in the Problems view with the reason.
- Generates AGENTS.md from board.yaml and these rules, so any Claude session pointed at the folder knows the format.
- Generates the card context files (§3.2).
- Moves Done and discarded cards older than 30 days to archive/YYYY/. An archived card can be restored to cards/.
- Global search (Ctrl K) includes archived cards.
- Shows a card on every board listed in boards.

### 4.10 Backup

- A git commit of the kanban folder after every Sync, plus once an hour when something changed.
- Time Machine on the Mac mini as well.

## 5. AI usage

Claude runs only when Josh presses Sync with Claude, or when he asks Claude in a chat. Duet runs only when Josh uses Duet. Nothing in the platform calls Claude on a timer, on data arrival or on constant checks.

| Runs AI | Trigger |
|---|---|
| Inbox note suggestions (project and boards) | Sync button |
| Kanban updates from notes, emails and EZ Binder changes | Sync button |
| Schedule proposals from Claude | Sync button, or a chat request |
| Kanban and deal changes from a chat | Josh asks Claude in a chat |
| Duet kanban and deal changes | Josh uses Duet. Can be switched off |

No AI, all ordinary code:

- Refresh, plus every data refresh: EZ Binder, Gmail, calendars, weather, GitHub build status, FTC, FCC, Twilio.
- Awaiting reply flags and project matching.
- Nudge drafts (template B).
- Josh's and the rule's schedule proposals.
- Note intake.
- Phone lookup.
- Archive, context files, AGENTS.md and backups.
- The Mac mini updater (§7.4).

Removed from v2:

- Scheduled syncs at 5am, 12pm and 5pm, and their on/off switch.
- Rewrite with Claude.

### 5.1 Sync with Claude

The button opens a popup with three items, all checked by default. Josh can uncheck any of them before Run sync.

1. Sort Inbox notes: suggest a project and boards for each pending note that has no suggestion. Uses board.yaml, deals, the Contacts list and EZ Binder customers.
2. Kanban updates: add or move cards from new notes, emails and EZ Binder changes since the last Sync. These apply directly, within the limits in §4.7.
3. Schedule proposals: propose schedule moves from EZ Binder data. Each one is sent as a proposal (§2.2).
- An item with nothing new since the last Sync is skipped without calling Claude.
- The popup shows last Sync tokens, dashboard tokens this week and the weekly plan %.
- After the run, a results list shows every change made, each with Revert, plus Revert all from this run.

### 5.2 Refresh

The Refresh button pulls new data on demand from Gmail, the three calendars, EZ Binder (/changes), weather and GitHub build status. No AI. Automatic refresh keeps running on its own schedule (§7.3).

### 5.3 Claude in a chat

- When Josh asks in a chat, Claude can add, move or update cards, file notes, update deals and propose schedule moves.
- On the Mac mini, Claude edits kanban files directly. Anywhere else, it uses the action layer (§4.8).
- Changes are logged with actor claude and a chat- run id, and can be reverted.

### 5.4 Revert

- Every change by Claude or Duet has a Revert button: in the card's history panel, the Sync results list and the Inbox (for filed notes).
- Revert restores the before values from the log line. It is logged as revert with the actor who pressed it.
- If the card changed again after the change being reverted, Revert shows both versions and asks before overwriting.
- A reverted schedule proposal is withdrawn in EZ Binder if it is still pending. A reverted deal change restores the earlier deal values.

### 5.5 Usage logging

- Each Sync run records type, items run, tokens and time from the run's usage output.
- Totals show on the Sync popup, the Builds screen and touch screen 2.
- A usage panel shows tokens per day for the last 30 days, split by Sync item.
- Chat and Duet usage happen outside the app and are not counted here.
- The plan share is an estimate from the same source the build tooling reads.

### 5.6 Account and model

- Sync runs on Josh's Max plan, with the same sign-in as the builds. No API key and no budget cap on Sync. The build budget (§7.1) covers builds only.
- Model choice per item: use the smallest model that does the job well.

## 6. Touch screen

Two swipe screens in dark glass, with large text. Display only, apart from the board toggle and swipe. Page dots sit at the bottom.

- Screen 1, Today:
  - Clock, date and weather (saved zip).
  - Josh / Christine / Bishops toggle.
  - Three stats. Josh: open A/R, received this week, inbox count. Christine and Bishops: their card counts.
  - Today.
  - That board's kanban in progress.
  - Waiting on and due this week.
  - Last refreshed and last synced times.
- Screen 2, Builds:
  - Clock.
  - Usage bars: weekly plan, Fable weekly, build budget (with HOLD shown when the hold is on), dashboard.
  - One row per project with a Queued / Building / Needs Josh / Landed tracker for its current build, the build name, and its place in the chain (for example "3 of 10").
  - Recent activity.
  - The same toggle. Choosing Christine or Bishops jumps to screen 1 with their data.
- Idle: returns to screen 1 after 3 minutes without a touch. The time is editable in Settings.
- Build needs Josh: the screen jumps to screen 2, a red alert banner names the build and the action, and that build's row turns red. The build budget hold starting triggers the same jump and banner ("Build budget reached, hold on").
- Build the swipe for any number of screens; more may be added later.
- Phone lookup does not appear on the touch screen.

## 7. Software builds and integrations

### 7.1 Software builds

Every project is built under docs/process.md: builds run unattended in GitHub Codespaces, one fresh session per build, started by the runner, and land on main without Josh when the landing rule holds. Command Center does not run builds. It shows their state and lets Josh answer their questions.

Tracked projects: Command Center, EZ Binder (including the EZ Binder API builds), Blueprint Creator, EZ Draft, FrameFocus and Popcorn Pilot. Each entry in Settings is a name and its GitHub repo; the list is editable.

Where the data comes from, all on GitHub:

| Item | Source |
|---|---|
| The build chain and its order | `BUILDS` in scripts/run_chain.py on the docs/next-builds branch |
| Landed | A commit on main whose message starts `[Merge] <NAME> (` |
| Building | The build's branch exists and its status file has no unanswered question |
| Needs Josh | The status file's Questions section has a question with no `Answer — Josh` line |
| Queued | In the chain, not landed, no branch yet |
| Progress and next step | The status file's Progress and PICK UP HERE sections (docs/sessions/<NAME>-status.md on the build's branch) |
| Last activity | The newest commit on the build's branch |
| Build budget | build-control/budget.json and usage.jsonl (process.md section 12) |

- GitHub access uses one token in the secret store. The app reads all tracked repos. It writes only three things: status files and docs/claude/chain.md on build branches (answers), and build-control/budget.json (limit and override).
- A build with no new commit for 3 hours while Building shows "No activity for [x] h" in amber. The runner itself is not visible from GitHub.

Builds screen:

- Usage tiles: weekly plan with the Monday 2:00 AM reset, Fable weekly, build budget, builds in progress (count across projects), and Command Center dashboard usage.
- Build budget tile: this week's build usage against Josh's weekly limit, as a percentage, with HOLD shown when the limit is reached and no override is in force. It covers builds only, not Command Center's Sync usage. An Override button sets an end time (default: the next Monday 2:00 AM reset) and writes it to budget.json. The limit and warning percentage are editable in Settings.
- One card per project: the current build's name, a Queued / Building / Needs Josh / Landed tracker, its place in the chain ("3 of 10"), the PICK UP HERE line, last activity, and the last landed build with its merge time.
- Projects needing Josh are outlined in red.

Act from the dashboard:

- Answer questions: each unanswered question shows in full, in process.md's shape (the question, the options and the recommendation). Josh picks an option or types an answer, one question at a time with next and previous.
- On submit, the app commits to the build's branch, with `[skip ci]` in the message:
  - `Answer — Josh, <date time> (verbatim): "<his answer>"` under that question in the status file;
  - the same ruling in docs/claude/chain.md, in the same commit (process.md section 9).
- When no unanswered questions remain, the card shows "Answers saved. Restart the runner" with the runner command from process.md section 2 and a Copy button. The app does not start the runner (process.md section 11).
- There is no Approve and merge. Builds land on their own under the landing rule. A landed build shows its merge commit and a link to it.

Notifications: bell count on Home, red Builds badge, and the touch screen alert (§6) for Needs Josh, for the budget warning (bell only) and for the hold starting (bell and touch screen).

Before Phase 8: Josh creates the private build-control repo once, and each project's runner is updated to the process.md section 12 version. Until then the budget tile shows "Budget not set up".

### 7.2 EZ Binder rules

From the S156 handoff:

- Send X-EZB-Actor on every call: claude for Claude-initiated calls, josh and rule for schedule proposals (§2.2).
- Claude never holds the key. Claude calls the dashboard, and the dashboard calls EZ Binder.
- Any date move other than one Josh confirms in EZ Binder returns 202 and shows as a proposal.
- Verify webhook signatures. Process each event id once. Keep the newest updated_at.
- No QuickBooks connection.

### 7.3 Integrations and refresh

All refreshes below are ordinary code with no AI. The Refresh button (§5.2) runs them on demand.

| Source | Use | Automatic refresh |
|---|---|---|
| EZ Binder API (S156) | Jobs, schedule, money, customers, estimates, schedule proposals | Webhooks (kept on) plus a background sync every 90 minutes via /changes |
| Gmail (josh@worthprop.com) | Awaiting reply, nudge drafts | Polling |
| Intake email address | Notes by email and text-to-email | On arrival |
| iPhone Shortcut (POST /api/notes) | Notes from the phone | On arrival |
| Google Calendar x3 | Today panel | Polling |
| Weather | Top bar, touch screen. Saved zip 33472, editable | Polling |
| GitHub: tracked repos and build-control | Builds screen, touch screen 2, Software projects, build budget | Polling every 2 minutes |
| GitHub: Command Center main | Updater on the Mac mini (§7.4) | Polling every 5 minutes |
| Twilio Lookup v2 | Phone lookup: caller name, line type | Per lookup, cached 30 days (§8.3) |
| FTC Do Not Call complaints | Phone lookup: complaint counts | Daily ingest (§8.3) |
| FCC unwanted call complaints | Phone lookup: complaint counts | Live query per lookup (§8.3) |
| Duet (if enabled) | Kanban and deal changes | Through the action layer when Josh uses Duet |

### 7.4 Updating Command Center on the Mac mini

Build sessions run in Codespaces and cannot reach the Mac mini. A small updater on the Mac mini, separate from the app so it keeps running when the app restarts, puts each landed Command Center build live. Ordinary code, no AI. Josh does nothing.

1. Every 5 minutes, and on Refresh, it checks main of the Command Center repo for a new `[Merge]` commit.
2. It waits until no Sync run is in progress.
3. It backs up the database and commits the kanban folder (§4.10).
4. It pulls main, installs dependencies, runs the production build and applies the database migrations.
5. It reads back the database objects each migration lists as expected and compares them.
6. It restarts the app and runs the smoke check: the app answers, both logins reach Home, the kanban loads, the touch screen reconnects. The smoke check lives in the repo, so each build keeps it current.
7. If step 4, 5 or 6 fails, it restores the previous version and the database backup, restarts the app, and raises a red alert on Builds and the touch screen: "Update failed, rolled back", with the log. The Command Center card shows Needs Josh until a later build lands and updates cleanly.
8. The Command Center card shows which merge is live on the Mac mini and when it went live.

### 7.5 How process.md applies to this project

Where this list and process.md differ, this list wins for Command Center. It goes into this repo's CLAUDE.md.

- **Production is the Mac mini.** Build sessions never touch it, its database or the real kanban folder.
- **Migrations:** landing rule condition 3 (migrations already on production before landing) does not apply. Migrations land with the code and the updater applies them (§7.4). Each migration lists the database objects it should produce, so the updater can read them back. No production grant is needed for this project's builds.
- **Deploy and smoke after merge** (process.md section 7) are the updater's job (§7.4). The build session's landing ends at the merge and the landing record.
- **Database rules:** no tenant id or row security (process.md section 6). This is a single-household local database. Keep explicit migrations, soft delete where data matters, and generated types.
- **Roles for tests:** Josh and Christine logins, plus the Claude, Duet and Shortcut tokens. Browser tests sign in as each login and reach every screen from the app's own menus. Permission tests state the answer for every role and token.
- **Tests and CI:** each CI job gets its own seeded local database and a temporary kanban folder. EZ Binder (until S156 is live), Gmail, Google Calendar, Twilio, FTC, FCC and GitHub are stubbed in CI. No real outside calls from CI.

## 8. Phone lookup

Built last (Phase 10). Uses no AI.

### 8.1 Purpose

Before calling back an unknown number, Josh or Christine enters it from the desktop or the iPhone. The lookup returns a verdict, Likely telemarketer, Unclear or Likely real person, with the reasons.

Out of scope: call blocking, incoming call screening, non-US numbers, and EZ Binder or QuickBooks contact matching.

### 8.2 Decisions

| Item | Decision |
|---|---|
| Where | Inside Command Center on the Mac mini: same database, logins, tunnel and secret store. No Vercel or Supabase |
| Users | Josh and Christine |
| Desktop | Phone lookup screen in the left menu. Quick add (Ctrl K) recognizes a pasted phone number and offers Look up number |
| Phone | iPhone Shortcut calling the lookup API through the tunnel (§8.7) |
| Data | Twilio Lookup v2, FTC Do Not Call complaints, FCC unwanted call complaints, and the users' own marks |
| History | 90 days, then deleted automatically |
| Marks | Mark spam / Mark real, with an optional note. Shared between Josh and Christine, showing who marked it. A mark sets the verdict on every future lookup until removed |
| FTC window | Rolling 12 months |

### 8.3 Data sources

#### Twilio Lookup v2 (paid, about $0.018 per lookup)

- GET https://lookups.twilio.com/v2/PhoneNumbers/{E164}?Fields=caller_name,line_type_intelligence, with basic auth.
- Fields used:
  - caller_name.caller_name.
  - caller_name.caller_type (BUSINESS / CONSUMER).
  - line_type_intelligence.type (mobile, landline, fixedVoip, nonFixedVoip, tollFree, and so on).
  - line_type_intelligence.carrier_name.
- Cache per number for 30 days. A Refresh button forces a new paid lookup.

#### FTC Do Not Call complaints (free)

- GET https://api.ftc.gov/v0/dnc-complaints, with the api.data.gov key in the X-Api-Key header.
- The API cannot filter by phone number. It filters only by date, state, city, area code or robocall flag, and returns at most 50 records per request. The data must be ingested into the local database and queried there.
- Store aggregates, not raw complaints: one row per number per month (§8.5).
- Daily ingest:
  - Runs at about 2:00 PM Eastern, after the FTC posts weekday data by about noon.
  - Pages through the previous day's created_date and upserts the monthly counts.
  - On Mondays it also pulls the weekend.
  - Prunes rows older than 12 months.
- Backfill:
  - A resumable job loads the last 12 months.
  - It respects the api.data.gov rate limit (default 1,000 requests per hour) and saves progress after every page, so it resumes after a restart.
  - Expect roughly 1 to 3 days.
  - Lookups work during the backfill with partial FTC counts, and the screen shows backfill progress.

#### FCC unwanted call complaints (free)

- Socrata open data API, dataset 3xyp-aqkj on opendata.fcc.gov, queried live by caller ID number with an FCC app token.
- Verify the exact field names and the phone number format (with or without dashes) against the live dataset before writing the query.
- Count complaints from the last 12 months. Keep the most recent date and the call type values.
- Time out after 3 seconds. The lookup still returns a result, marked "FCC data unavailable."

### 8.4 Scoring

If a mark exists, the verdict is the mark ("Marked spam by Josh" / "Marked real by Christine"), with the collected data still shown below it. Otherwise, add points:

| Signal | Points |
|---|---|
| FTC complaints, last 12 months: 1 to 2 / 3 to 9 / 10+ | +2 / +3 / +4 |
| FCC complaints, last 12 months: 1 to 2 / 3+ | +2 / +3 |
| Any complaint flagged robocall / prerecorded | +1 |
| Line type nonFixedVoip | +2 |
| Line type fixedVoip or tollFree | +1 |
| No caller name, or a generic one ("WIRELESS CALLER", a city or state, "UNKNOWN") | +1 |
| CONSUMER with a personal name, on mobile or landline, with zero complaints | −2 |

- Verdict: 4 or more = Likely telemarketer; 2 to 3 = Unclear; 1 or less = Likely real person.
- Reasons are listed in plain words, for example "14 FTC complaints in the last 12 months (most recent Oct 28)", "Internet phone line (VoIP)" or "No registered name".
- Points and thresholds live in one config file, editable in Settings, for tuning during testing.

### 8.5 Data

- ftc_counts: phone (10 digits), month (first of month), complaints, robocalls, last_seen, top_subject. Key (phone, month); index on phone.
- ftc_sync_state: last fully synced date, backfill cursor and progress.
- twilio_cache: phone, caller_name, caller_type, line_type, carrier, fetched_at.
- phone_lookups (history): id, phone, verdict, score, reasons, source (desktop / shortcut), user, created_at. Deleted after 90 days by the daily job.
- phone_marks: phone, label (spam / real), note, user, created_at. Shared by both users.

### 8.6 Phone lookup screen

Uses the dashboard's existing layout and glass styles.

- A number input at the top that auto-focuses, accepts any format or pasted text containing a number, and runs on Enter.
- Result card:
  - A large colored verdict (red / amber / green).
  - The formatted number, caller name and line type.
  - The reasons list.
  - FTC and FCC counts with the most recent date.
  - Buttons: Mark spam, Mark real, Refresh and Copy number.
- History below: the last 90 days (number, verdict, name, who looked it up, date). Searchable, with click to reopen. Marked numbers show a tag.
- Status line: "FTC data current through [date]", plus backfill progress while it runs.
- Limitations note:
  - Spoofed numbers can look clean or show the innocent owner.
  - New telemarketer numbers may have no complaints yet.
  - Many cell numbers have no registered name.
  - Complaint data is unverified.

### 8.7 iPhone Shortcut

- API:
  - POST /api/phone/lookup (body { phone, refresh?, source: "shortcut" }).
  - PUT and DELETE /api/phone/mark.
  - POST /api/notes for note intake (§4.4).
- These routes accept a Shortcut token (Bearer header) instead of the interactive login. The token works for these routes only, can be revoked and regenerated in Settings, and is rate limited.
- Deliver step-by-step guides for building two Shortcuts, not signed files.
- Lookup Shortcut:
  1. Input: text from the Share Sheet; if none, the Clipboard.
  2. Get Contents of URL → the lookup route through the tunnel URL.
  3. Notification: verdict, caller name, and the top two reasons.
  4. Menu: Call, Mark spam, Mark real, Done.
- Note Shortcut:
  1. Input: dictated or typed text, or text from the Share Sheet.
  2. Get Contents of URL → POST /api/notes.
  3. Notification: "Note added to Inbox."
- Note for Josh: the iPhone Phone app can't share from Recents. Tap (i), press and hold the number, Copy, then run the Shortcut from the home screen, Siri or Back Tap. Numbers in Messages and Mail can be shared directly.

### 8.8 Users and boards

Phone lookup is available to both logins and is not tied to a board. The board toggle does not filter it.

### 8.9 Accounts Josh creates

1. Twilio account (pay as you go): Account SID and Auth Token.
2. api.data.gov key (free) for the FTC API.
3. FCC open data app token (free).

Expected cost: about $0.018 per new Twilio lookup; repeat lookups within 30 days are free. At 10 lookups a day, that is about $5 to $6 a month. Everything else is free.

## 9. Out of scope

- QuickBooks.
- Editing EZ Binder money records.
- Anything EZ Binder's handoff §10 rules out.
- Mobile layout and phone location, held until the build is complete. The Shortcuts (§8.7) are the only phone access.
- Scheduled Claude runs and Rewrite with Claude.
- Call blocking and incoming call screening.
- Any Kanban Pro code, assets or design files.
- Starting or restarting the build runner from the dashboard (process.md section 11).
- Approving merges: builds land on their own under process.md.
- The runner change for the build budget. It belongs to each project's runner (process.md section 12), not to this build.

## 10. Settled decisions

All open questions from v2 and the storage handoff were answered on 2026-11-09.

| Question | Decision |
|---|---|
| Deal stages | Two types. Sale: Lead, Estimating, Proposal sent, Negotiating, Won, Lost. Development: Due diligence, Entitlement, Financing, Closing |
| Deal to estimate link | Specific estimates per deal, several allowed |
| Lenders and partners | Contacts list in Command Center (§3.4) |
| SMS intake | Free text-to-email plus an iPhone Shortcut |
| Nudge template | Template B (§2.1), editable |
| Touch screen idle | 3 minutes, editable |
| Weather location | Saved zip 33472, editable. No location services until mobile |
| Phone lookup phase | Last (Phase 10) |
| Christine has Phone lookup | Yes |
| Spam/real marks | Shared, showing who marked |
| Duet access | Through the action layer, with an on/off switch |
| Christine's kanban access | Through the app only |
| Kanban backup | Git commit after every Sync and hourly when changed, plus Time Machine |
| Claude in a chat | Allowed to change cards, notes, deals and schedule proposals |
| AI in the platform | Sync button only, no scheduled runs; chat; Duet. Everything else is ordinary code |
| Claude kanban updates | Apply directly, with Revert |
| Schedule proposals | Josh drag, slip rule and Claude |
| Card ids | Assigned by the app; Claude and Duet use new/ |
| Build budget tile | The weekly build budget from process.md section 12: usage against the limit, hold state, Override. Builds only, not Sync |
| Build status source | GitHub: chain list, status files, merge commits |
| Build stages | Queued, Building, Needs Josh, Landed |
| Build questions | Answered on the dashboard and written to the status file; Josh restarts the runner |
| Command Center updates | Updater on the Mac mini with smoke check and rollback (§7.4) |

## 11. Acceptance checks

#### Boards and screens

- [ ] The board toggle switches every panel, tile and list to that board's data. Items marked for several boards appear on each
- [ ] Glass theme on every screen; no Kanban Pro code or assets in the repository
- [ ] Touch screen returns to screen 1 after the idle time; swipe works both directions
- [ ] Reachable from outside the home network with login; Christine's login sees everything

#### Kanban storage

- [ ] A card edited by hand in its file reloads in the app within 2 seconds
- [ ] A file with invalid frontmatter shows in Problems with the reason and is not dropped
- [ ] A card written to new/ gets the next id and moves to cards/ within a second
- [ ] Two writers changing the same card at once both keep their changes
- [ ] Unknown fields survive a rewrite
- [ ] Every change has a log line with the correct actor, run id and before/after values
- [ ] A change Claude makes directly in a card file gets a log line written by the app, with actor claude, its run id and before/after values, and Revert undoes it
- [ ] Done and discarded cards move to the archive after 30 days; search finds them; restore works
- [ ] A second Sync over the same email or EZ Binder change creates no duplicate card
- [ ] The Windows PC reads and writes cards through the app only
- [ ] A git commit exists after each Sync

#### AI usage

- [ ] Nothing calls Claude except the Sync button; verified from the usage log over 48 hours with the app running
- [ ] Unchecked Sync items do not run; an item with nothing new is skipped without a Claude call
- [ ] Refresh makes no Claude call
- [ ] Revert restores a Claude or Duet change and is logged; Revert all undoes a whole Sync run
- [ ] Claude and Duet cannot move a card to Done or discarded, change boards, or rewrite a card body unless Josh asks in a chat
- [ ] With the Duet switch off, Duet's token is refused

#### Inbox and email

- [ ] Inbox notes never file without confirmation; Dismiss removes a note without making a card
- [ ] Notes arrive from the intake email, a text-to-email message and the note Shortcut
- [ ] Awaiting reply flags at 2 days, and at 1 day for clients with active jobs; No reply needed removes only that thread
- [ ] Nudge creates a Gmail draft from template B ending at "Thanks," and sends nothing

#### EZ Binder and schedule

- [ ] Money tiles match EZ Binder GET /summary/ar to the cent
- [ ] An EZ Binder schedule change reaches Home and the touch screen within about 10 seconds; with webhooks blocked, within 90 minutes
- [ ] Proposals from Josh, the slip rule and Claude each show as proposals with their source and change nothing in EZ Binder until Josh confirms
- [ ] No QuickBooks calls anywhere

#### Builds

- [ ] Each build in a project's chain shows the right stage (Queued, Building, Needs Josh, Landed) within 2 minutes of the change on GitHub
- [ ] A new unanswered question makes the touch screen jump to screen 2 with the red alert, and the bell count updates
- [ ] An answer submitted on the dashboard appears in the status file on the build branch, verbatim with the time, with chain.md changed in the same commit, pushed with [skip ci]; the card then shows the runner command
- [ ] The app writes to GitHub only status files and chain.md on build branches, and budget.json in build-control
- [ ] The budget tile matches this week's total in build-control/usage.jsonl; HOLD shows when the runner would hold; Override writes override_until and the next runner start proceeds
- [ ] A Command Center merge is live on the Mac mini within 10 minutes with the smoke check passing
- [ ] A deliberately broken build is rolled back to the previous version and database, with the red alert

#### Phone lookup

- [ ] Returns a verdict with reasons for any US number in any format, from the desktop and from the Shortcut
- [ ] Makes no Claude calls; a repeat lookup within 30 days makes no Twilio call
- [ ] The FTC backfill stops and resumes without losing progress; the daily ingest runs and prunes data older than 12 months
- [ ] An FCC timeout still returns a result marked "FCC data unavailable"
- [ ] A spam/real mark overrides the verdict on the next lookup for both users; removing it restores scoring
- [ ] Lookup history older than 90 days is deleted
- [ ] The Shortcut token works only on the phone and note routes and stops working once revoked
- [ ] On Josh's test list (5 real people, 5 businesses, 5 to 10 known spam calls), at least 80% of verdicts match his expectations

## 12. Phase plan

Each phase is one build in the runner's BUILDS list, with its own spec in docs/specs/, run under docs/process.md: one fresh session per build, landing without Josh when the landing rule holds. Questions come to Josh on the dashboard (once Phase 8 has landed) or through the chat session. Times are estimates with no prior build data; recalibrate after the first two phases.

| Phase | Scope | Agent time | Calendar time with reviews |
|---|---|---|---|
| 1 | Repo set up per process.md section 9 with the §7.5 changes, app shell, database, logins, the three boards, secure remote access, secret store, glass theme base, and the Mac mini updater (§7.4) so every later build goes live on its own | 4 to 6 h | 1 to 2 days |
| 2 | Kanban storage (§4: folders, new/, validation, Problems, watch, log, archive, AGENTS.md, context files, git backup), kanban board, item visibility, named members, Revert, card commands in the action layer, Quick add | 7 to 10 h | 2 to 3 days |
| 3 | Home layout, panels, Google calendars, weather, Refresh | 4 to 6 h | 1 to 2 days |
| 4 | Note intake (email, text-to-email, note Shortcut route), Inbox, Awaiting reply with rule matching, nudge template | 5 to 8 h | 2 days |
| 5 | Deals, Contacts, Projects cards, deal commands in the action layer | 4 to 6 h | 1 day |
| 6 | EZ Binder connection, update receiver, 90 minute sync, GC schedule, Josh and slip rule proposals | 6 to 9 h | 2 days (needs S156 to test live) |
| 7 | Sync with Claude: popup, three items, results list with Revert, usage logging; Duet connection behind its switch | 4 to 6 h | 1 to 2 days |
| 8 | Builds screen from GitHub, answering build questions, build budget tile and Override, alerts | 5 to 8 h | 2 days |
| 9 | Touch screen, swipe, idle and alert behavior | 3 to 5 h | 1 day |
| 10 | Phone lookup: FTC ingest and backfill, Twilio, FCC, scoring, screen, marks, history, Shortcut API and guides | 5 to 7 h | 2 days + 1 to 3 days of background backfill |

Phase 10 check by Josh after it lands: he looks up a number from the desktop and from the iPhone Shortcut, marks one as spam, and runs his test list. Before Phase 10 starts, he provides the three keys (§8.9) and 15 to 20 known numbers.

Total: roughly 47 to 71 hours of agent time across 10 phases.
