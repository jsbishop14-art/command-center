# CC2 status: kanban storage and board

Branch: cc2-kanban. Spec: docs/specs/CC2-BUILD-SPEC.md. Handoff sections: 3.1, 3.2, 4, 5.4.

## RESUME

### Josh's words (verbatim, from spec §0)

- 2026-11-09 13:10, answers: "1. yes 2. yes 3. yes" (build from scratch; glass theme; kanban stored as Markdown files
  that Claude and Duet can edit).
- 2026-11-09 14:47, on who writes kanban log lines: "i dont follow. you decide" (decided: only the app writes them).
- Requirements: handoff sections 3.1, 3.2, 4 and 5.4. Layout: docs/mockup/Kanban.dc.html.

### Starting prompt (verbatim)

Unattended run in a FRESH session, started by scripts/run_chain.py. Your job is ONLY build CC2.
1. Read CLAUDE.md, docs/claude/chain.md and the handoff sections your spec names. If docs/specs/CC2-BUILD-SPEC.md is not on main, bring it
   from origin/docs/next-builds with your first commit.
2. git fetch origin. If origin/cc2-kanban exists: check it out, report git status (never discard uncommitted work), read
   docs/sessions/CC2-status.md and continue from PICK UP HERE. Otherwise create cc2-kanban from origin/main and the
   status file with a RESUME block quoting the spec's section 0 and this prompt verbatim.
3. Build docs/specs/CC2-BUILD-SPEC.md per docs/process.md section 4 (decide and log; hard stops only). Commit and push the feature branch
   after every step. ONE deliberate CI run. Keep a tool call printing output at least every 20 minutes.
4. No production grant. Production is Josh's Mac mini, which build sessions never touch (handoff section 7.5). Migrations land with the code and the Mac mini updater applies them. No real outside calls: use the stubs. No real email, ever.
5. Land per the landing rule as adapted in CLAUDE.md (handoff section 7.5). The merge commit message MUST start with
   "[Merge] CC2 (". The Mac mini updater deploys and smoke-checks after the merge (handoff section 7.4). Record the
   landing in chain.md and the status file.
6. Then STOP. Do not start the next build. If a hard stop or a question for Josh blocks landing, write it in the status
   file's Questions section (plain text, full question, options, recommendation), push, and end. If the status file
   already holds questions with NO recorded answer, change nothing and end at once, saying so: Josh answers through the
   chat session or the Command Center dashboard, which record the answers in the status file.

### Grant

None. Production is the Mac mini; build sessions never touch it, its database or the real kanban folder (handoff 7.5).
No real outside calls (use stubs). No real email, ever. Migrations land with the code; the Mac mini updater applies them.

### Hard stops (wait for Josh)

- A production pre-read or read-back that doesn't match what was committed (not applicable: no production access).
- A failed deploy or smoke check after a merge (the updater does this on the Mac mini, not the build session).
- Any production data write that wasn't granted by name.
- Anything that can't be undone.

### Later rulings (verbatim, with time)

(none yet this build)

## Decided without asking

- D-1 Kanban DB-side state (snapshot cache, app_settings, action_tokens, kanban_problems, card id
  sequence) lives in SQLite migration 0002_kanban; the cards themselves stay as files (handoff §4:
  no database table for cards). Reason: handoff §4.6 says the app keeps a snapshot of each card to
  compute before/after; persisting it means hand-edit diffs survive a restart. Changes no ruling,
  writes no real data, undoable.
- D-2 No third-party YAML dependency. A small flat frontmatter parser (src/lib/kanban/frontmatter.ts)
  for card and pending files, and a constrained board.yaml reader/writer the app fully controls.
  Reason: card frontmatter is flat key/value with flow lists; keeps the Mac mini self-contained and
  CI free of surprises; unknown fields are preserved (handoff §4.7 rule 6).
- D-3 `server-only` is stubbed under Vitest (tests/unit/stubs/server-only.ts) so server modules can
  be unit-tested; it is a build-time guard with no runtime. Also added `@/` alias to vitest.config.
- D-4 The local `kanban/` folder at the repo root is gitignored; the real kanban folder lives on the
  Mac mini and is never committed from a build session (handoff §7.5).

## Questions

(none)

## Progress

- Step 0: branch cc2-kanban from origin/main; brought CC2-BUILD-SPEC.md from origin/docs/next-builds; wrote this
  status file. hooks path set to scripts/hooks.
- Step 1: kanban storage core — paths, frontmatter parse/serialize (unknown fields survive), card
  parse/validate + serialize, board.yaml read/write, atomic write + re-read-before-write store,
  DB-backed state (id sequence, settings, problems, snapshots). Migration 0002_kanban (5 tables).
  typecheck 0; unit 34/34 (kanban-storage 11/11 new).

## PICK UP HERE

Step 2: activity log + snapshot differ.
