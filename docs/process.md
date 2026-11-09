# process.md: how a new project is built unattended with Claude Code

This is the build process as it runs on EZ Contractor Binder in November 2026. It is based on what worked and what failed
across about 180 sessions. Hand this file to a new project's first chat session. That session puts it in the repo at
`docs/process.md`, writes a short `CLAUDE.md` from section 9, and commits the runner from section 10.

---

## 1. Who does what

| Who | Job | Never |
| --- | --- | --- |
| **Josh** (owner, the only human) | Says what to build. Answers questions. Grants production access in words. | Writes code, pastes SQL, runs anything other than the runner command |
| **Chat session** (planner, Claude in the app) | Turns Josh's words into specs. Writes specs, rulings and answers **directly into the repo** on the plan branch. Checks state on GitHub. Relays questions to Josh. | Asks Josh to copy files or paste code. Trusts a summary over git. |
| **Build session** (Claude Code, one fresh session per build, unattended) | Builds one spec on its own branch, tests it, deploys its migrations under the grant, lands it, then stops. | Starts the next build. Pushes to `main` except through the landing rule. |
| **Runner** (`scripts/run_chain.py`, Python) | Starts one fresh build session per build, in order. Checks whether each build landed, retries once, and stops when a build needs Josh. Records each session's usage and holds new sessions at the build budget (section 12). | Makes decisions. |

**What worked:** the chat session writes straight to the repo, Josh answers in one line, and the runner picks the work up.
**What failed:** before this, Josh copied text between chat and the terminal, a round trip per question.

---

## 2. The loop

1. **Josh says what he wants.** The chat session restates it, checks the code and data on GitHub, and asks every
   question at once as a numbered list. Josh answers by number ("1. a 2. b").
2. **The chat session writes the spec**:
   - It goes in `docs/specs/<NAME>-BUILD-SPEC.md` on the plan branch (`docs/next-builds`).
   - §0 quotes Josh's words verbatim, with the time.
   - The spec says **what the user gets and what must stay true**, never only how to build it.
3. **The chat session adds the build to the runner's list** (`BUILDS` in `scripts/run_chain.py` on the plan branch) and
   pushes. A runner that is already going picks it up, because it re-reads the list from the remote before every build.
4. **Josh runs one command** at the plain terminal prompt (not inside a Claude chat):
   ```
   cd <repo> && git fetch -q origin docs/next-builds && git show origin/docs/next-builds:scripts/run_chain.py > ~/run_chain.py && python3 ~/run_chain.py
   ```
5. **Each build session**:
   - branches from current `main`
   - writes a status file
   - builds and commits after every step, pushing the feature branch every time
   - runs the local checks, then ONE CI run
   - pushes its own migrations under the grant
   - lands, deploys, smoke-tests, records the landing, and **stops**
6. **If it needs Josh**, it writes the question in the status file and ends. The runner stops and prints the question.
   Josh answers in the chat session. The chat session writes the answer, verbatim with the time, into the status file,
   pushes, and gives Josh the runner command again. The next fresh session resumes from the status file.
7. **After a landing**, the runner pastes the session's final message. The chat session checks it against GitHub
   (merge commit, CI run, tech-debt numbers) and tells Josh in a few lines what landed and what waits on him.

---

## 3. Response rules for every Claude (chat and build)

- **Short.** Answer first. Give one action per message when Josh has to do something, then what he should see if it
  worked.
- **Factual and neutral.** No praise, no "great question", no emotional framing.
- **Questions go in plain text, all at once, in the final message of the turn. Never use the interactive picker.**
  Why: the picker gives one question per turn, its answers lose the question, and Josh is notified only when a turn
  ends. Shape:
  ```
  Qn. [NAME-ASK-n] <the question in full; assume no memory>
  Options: A) …  B) …  C) …
  My recommendation: <which, and why in one line>
  ```
- **Plain words.** Josh is a contractor, not a programmer. Say what a change means for the user, not its mechanics. No
  internal jargon in messages to him.
- **Verify before claiming.** A context file, summary or commit message is a claim; git and the database are the facts.
  Say what you checked ("Confirmed: X is on main at abc123").
- **No dashes in file names of documents sent out.** Use spaces.

---

## 4. Unattended rules (the playbook)

Build sessions run without Josh. They **do not stop for minor decisions**.

1. **Decide and log.** If your recommended option changes none of Josh's rulings, widens no one's access or view of
   money, writes no production data, and can be undone, then take it. Log it under "Decided without asking" in the
   status file and keep going.
2. **Table, don't stall.** If something truly needs Josh, write that one item as a question and keep doing all the work
   that doesn't depend on it.
3. **Hard stops (wait for Josh):**
   - a production pre-read or read-back that doesn't match what was committed
   - a failed deploy or smoke check after a merge (revert the merge first)
   - any production data write that wasn't granted by name
   - anything that can't be undone
4. **A session whose status file holds unanswered questions changes nothing and ends at once.** This prevents a
   retry from answering its own question.
5. **Commit after every step, and push the feature branch after every commit.** A step is the smallest piece still
   worth having if the next one never ran. *Failed: a cloud workspace restart destroyed unpushed work at least 12 times.*
6. **One fresh session per build.** *Failed: one long session for many builds ran out of context and lost the thread.
   A fresh session that reads the status file resumes cleanly.*
7. **Keep output flowing** (a tool call that prints at least every 20 minutes; the runner prints a heartbeat every 10)
   so an idle timeout doesn't kill the workspace. Set the workspace idle timeout to its maximum.

---

## 5. The status file (`docs/sessions/<NAME>-status.md`)

This is the only memory a build has between sessions. Sections, in order:

- **RESUME:**
  - Josh's words verbatim (from spec §0)
  - the starting prompt verbatim
  - the grant
  - the hard stops
  - every later ruling, verbatim with its time
- **Decided without asking:** numbered `D-1, D-2, …`, each with the reason.
- **Questions:** in the §3 shape. When answered: `Answer — Josh, <date time> (verbatim): "…"`, then what it means.
- **Progress:** one line per step, with the numbers (test tallies, timings, commit hashes).
- **PICK UP HERE:** exactly what the next session does first.

---

## 6. Quality rules that came from real failures

| Rule | The failure behind it |
| --- | --- |
| **Every commit that adds or changes a test states its tally (`unit 14/14`) or says NOT RUN.** | A test was committed, pushed twice, and had never passed: its selector could not match. |
| **Every new screen or button gets a browser test that signs in as each role and reaches it by clicking from the app's own menus.** No direct URL. Roles it isn't for: assert the entry point is absent. | Many features were built and never connected to the navigation, so nobody could find them. |
| **Permission tests state the answer for every role** (a total map typed by the role list), deny and allow. | A hand-listed test said nothing about one role, and that role silently got refund authority. |
| **Never judge a result through a pipe or wrapper.** Read the real exit code (`cmd > log 2>&1; echo $?`), state row counts, and run a control that must fail. | `tail`, `echo`, cached results and empty output have all been read as passes. |
| **Never reformat a file the repo doesn't already format, and never apply zero-context patches to code.** | A formatter buried 40 real lines in 1,300 lines of reflow; a zero-context patch moved one function's body into another. |
| **Measure speed only on a production build** (`next build && next start`) or production. | Dev-mode compile time was read as slowness for four sessions. |
| **Write files with the editor tools, never shell heredocs.** | Heredocs ate `<a` in JSX and mangled a SQL migration. |
| **When a rule changes, search for existing tests of the old rule and invert them.** | A test titled with the old rule stayed green through two audits. |
| **Audit by what is actually called, not by a name or catalog filter.** | A filter missed the live version of a function; it was safe by luck. |
| **Specs say what the user gets.** | A spec described how to build a "view as" feature; the result was technically correct and nearly useless. |
| **Tech-debt numbers on a branch are `#N-<tag>`, converted to real numbers at landing.** | Two branches allocated the same number. |
| **Every new database table gets explicit grants, tenant id and row security in its creating migration.** | Missing defaults caused 403s; the platform stopped granting by default. |

---

## 7. CI, landing and production

- **Before the CI push, run locally:** the full unit suite, lint, type-check and the build, each with caching off and
  each exit code read on its own line. Record the results in the CI commit.
- **One deliberate CI run per build.** Budget: 1 deliberate + 2 infrastructure re-runs + 2 fix runs = 5, then stop
  that build. Every other push carries `[skip ci]` (a pre-push hook refuses a push without it unless `ALLOW_CI=1`).
  *Failed: unbudgeted runs used up the monthly Actions spend.* Classify every red from the log before re-running:
  - **Infrastructure:** re-run.
  - **Wrong test, proven:** fix it.
  - **Bug this build caused:** fix it with a test that goes red first.
  - **Older problem:** a small separate fix branch, or tech debt.
  - **Unexplained intermittent:** move it to a non-blocking job that still reports. Never skip it.
- **Shard CI across jobs** once the suite passes ~30 minutes. *Failed: one overloaded runner made timing reds.*
- **The branch lands without Josh when all three hold:**
  1. CI is green on the branch rebased onto current `main`. Alternatively, CI is green and the only difference since
     the tested tree is under `docs/` or root `*.md`; the merge message lists the changed paths and the command used.
  2. Every agreed check passed, with its number stated.
  3. Every migration the branch carries is already on production, verified object by object.

  The merge message starts with `[Merge] <NAME> (`, which the runner looks for.
- **Production migrations:**
  - Only under a grant Josh gave in words, in the starting prompt or a recorded answer.
  - Commit the expected before and after values **before** reading production.
  - Push one file per push, with a dry run that lists exactly that file.
  - Read back by object, and compare permission lists as sorted sets.
  - A mismatch is a hard stop: undo with the committed restore file and table the question.
  - *Failed: a session that adjusted its expectations after reading production would have hidden real drift. That rule
    found 13 functions that differed between production and the test database.*
- **After every merge:** check the hosting deploy status and run the smoke checks. If either fails, revert the merge at
  once.
- **No production data writes** unless granted by name, as a committed script with a dry run showing counts, the write,
  and a read-back.
- **Test accounts** sign in by Josh only on production. Claude never types a production password, never pays, never
  signs, never sends real email outside production.

---

## 8. Environment

- The work runs in a cloud workspace (GitHub Codespaces), not on Josh's computer. Node 20. `.env.local` doesn't survive
  a rebuild; recreate it from the host's env vars.
- Build sessions run on **Josh's normal Claude plan**: the runner removes `ANTHROPIC_API_KEY` from the session
  environment so nothing bills API credit. No Agent SDK or pip install is needed, only the `claude` CLI and Python 3.
- **Hosting builds only `main`.** Run the production build locally before every merge.
- A shared test database for CI and local checks, and production. Each CI worker gets its own seeded company, so tests
  don't collide.
- **Keep branches few:** one branch per build, run in order, each started from the `main` the previous build left.
  Delete landed branches.
- The chat session sometimes can't delete branches through its proxy; Josh deletes them from the workspace terminal.

---

## 9. What goes in the new project's CLAUDE.md (keep it under ~350 lines)

`CLAUDE.md` holds rules in their working form. The full text, incidents and superseded wording go in small files under
`docs/claude/` (directories of small files, so a session reads only what it needs). Start with:

1. Project, owner, repo, live URL, stack.
2. The run protocol:
   - branch first, never edit on `main`
   - analyze, then ask all questions at once, then build
   - unattended runs commit and push after each step
3. The landing rule and the production rule from section 7.
4. The quality rules from section 6.
5. Questions in plain text, never the picker (section 3).
6. Database conventions (tenant id, row security on every table, grants, soft delete, generated types).
7. Roles and permission floors, as tables. Every new ruling is recorded verbatim, the old wording quoted as superseded.
8. References: `docs/claude/chain.md` (the build order, grants, rulings in force, what waits on Josh), `STATE.md`,
   `TECH_DEBT.md`.

Every new Josh ruling goes into the current build's status file and `chain.md` in the same commit.

---

## 10. The runner (`scripts/run_chain.py`)

The chat session commits this to the plan branch. Edit `BUILDS` to add builds. This project's copy is
`scripts/run_chain.py` on the plan branch `docs/next-builds`; it is the reference version of this section, with the
Command Center build list and grant text.

---

## 11. Known gaps (not solved yet)

- The runner can't tell a usage-limit stop from a real failure; it retries once and stops. Re-run later.
- A build that needs Josh stops the whole queue, even when later builds don't depend on it.
- CI still shares one test database for live tests; giving CI its own database is the next unlock for more parallel
  workers.
- Josh still has to restart the runner after answering a question. A chat session can't start it for him yet.
- The build budget is checked only between sessions. A session that starts just under the limit runs to its end and can
  go over. This is by design (in-progress work finishes), but the overage can be large on a long build.
- Usage is counted from the session's own report when it ends. A session killed before it reports (workspace restart,
  usage-limit stop) records nothing, so the tile can read low.

---

## 12. Build budget

A weekly limit on how much the builds use, across every project's runner. Added 2026-11-09.

**What Josh gets:**

- He sets one weekly limit for all builds.
- He is told when the builds reach the warning level (80% by default) and when they reach the limit.
- At the limit, a **hold** starts: no new build session starts, and a session already running finishes its work.
- He can override the hold until a time he chooses. The hold also clears at the weekly reset, Monday 2:00 AM Eastern.
- Command Center's Builds screen and touch screen show how close the builds are to the limit and whether the hold is
  on. The budget covers builds only, not Command Center's own Sync usage.

**How it works:**

- One GitHub repo, `build-control`, holds the budget for every project. Josh creates it once (empty) and every runner
  is pointed at it with the environment variable `BUILD_BUDGET_REPO` (its clone URL). Without that variable the runner
  works as before, with no budget.
- `build-control/budget.json`, written by the chat session or by Command Center:
  ```json
  {"weekly_limit_tokens": 40000000, "warn_pct": 80, "override_until": null}
  ```
  `override_until` is a time with time zone, for example `"2026-11-12T18:00:00-05:00"`. Before that time the hold
  is off even over the limit. `null` means no override. The limit shown is an example; Josh sets the real one. While
  `weekly_limit_tokens` is `null`, usage is still recorded but there is no hold.
- `build-control/usage.jsonl`: the runner appends one line when each build session ends, from the session's own usage
  report, and pushes it with `[skip ci]`:
  ```json
  {"at":"2026-11-09T16:40:00-05:00","repo":"ez-binder","build":"S157","tokens":812000,"cache_read_tokens":9400000,"cost_usd_equiv":31.2,"minutes":74}
  ```
  `tokens` counts input, cache-creation and output tokens. Cache reads are recorded but not counted, because they are
  cheap and would swamp the total. `cost_usd_equiv` is the session's equivalent API price, kept for comparison only;
  builds still run on the plan and bill nothing.
- Before starting any session (including the retry), the runner sums this week's `tokens` and compares it with the
  limit. At or over the limit, with no override in force, it prints `HOLD: …` and exits with code 3. Nothing is lost:
  re-running after the reset or an override continues from the same build.
- Command Center reads both files from GitHub for the tile, sends the warning and hold notifications, and has an
  Override button that writes `override_until`.

**Checks to verify the change to the runner:**

- With `BUILD_BUDGET_REPO` unset, a dry run behaves exactly as before.
- With a limit below the week's usage, the runner prints `HOLD` and exits 3 without starting a session.
- With an `override_until` in the future, the same run starts the session.
- After a session ends, `usage.jsonl` on GitHub has one new line for it.
- Read the usage field names from a real `stream-json` result line of the installed `claude` CLI before trusting the
  count; if the names differ, fix `record_usage` and say so in the status file.
