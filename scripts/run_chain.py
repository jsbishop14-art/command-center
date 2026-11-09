#!/usr/bin/env python3
"""Run the planned builds one after another, each in a FRESH Claude Code session, on the normal Claude plan.

For each build in BUILDS, in order:
  - already landed? (origin/main has a merge commit starting "[Merge] NAME (")  -> skip
  - else start `claude -p` with that build's prompt; it builds, lands, then stops
  - not landed -> one more fresh session (it resumes from the status file); still not -> stop (Josh is needed)
Re-running is safe: landed builds are skipped. BUILDS is re-read from the plan branch before every build.
Before every session the build budget is checked (docs/process.md section 12); at the limit nothing new starts.
Run: cd <repo> && python3 ~/run_chain.py   (or --from NAME, --only NAME, --dry-run)
"""
import argparse, json, os, shutil, subprocess, sys, threading, time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

REPO = os.environ.get("REPO_DIR") or os.getcwd()
PLAN_BRANCH = "docs/next-builds"
HEARTBEAT_SECONDS = 600
# Build budget (docs/process.md section 12). Shared by every project's runner. Unset = no budget.
BUDGET_REPO = os.environ.get("BUILD_BUDGET_REPO", "")
BUDGET_DIR = os.path.expanduser("~/.build-control")
TZ = ZoneInfo("America/New_York")
GRANT_BASE = ("No production grant. Production is Josh's Mac mini, which build sessions never touch (handoff section "
              "7.5). Migrations land with the code and the Mac mini updater applies them. No real outside calls: use "
              "the stubs. No real email, ever.")

# (name, branch, spec, extra grant or note in Josh's words)
BUILDS = [
    ("CC1", "cc1-foundation", "docs/specs/CC1-BUILD-SPEC.md", ""),
    ("CC2", "cc2-kanban", "docs/specs/CC2-BUILD-SPEC.md", ""),
    ("CC3", "cc3-home", "docs/specs/CC3-BUILD-SPEC.md", ""),
    ("CC4", "cc4-inbox-email", "docs/specs/CC4-BUILD-SPEC.md", ""),
    ("CC5", "cc5-deals-contacts", "docs/specs/CC5-BUILD-SPEC.md", ""),
    ("CC6", "cc6-ez-binder", "docs/specs/CC6-BUILD-SPEC.md", ""),
    ("CC7", "cc7-sync", "docs/specs/CC7-BUILD-SPEC.md", ""),
    ("CC8", "cc8-builds", "docs/specs/CC8-BUILD-SPEC.md", ""),
    ("CC9", "cc9-touch-screen", "docs/specs/CC9-BUILD-SPEC.md", ""),
    ("CC10", "cc10-phone-lookup", "docs/specs/CC10-BUILD-SPEC.md", ""),
]


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def git(*args):
    return subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True).stdout.strip()


def latest_builds():
    git("fetch", "-q", "origin", f"+refs/heads/{PLAN_BRANCH}:refs/remotes/origin/{PLAN_BRANCH}")
    src = git("show", f"origin/{PLAN_BRANCH}:scripts/run_chain.py")
    try:
        start = src.index("BUILDS = [")
        end = src.index("\n]\n", start) + 2
        scope = {}
        exec(src[start:end], {}, scope)
        if all(isinstance(b, tuple) and len(b) == 4 for b in scope["BUILDS"]):
            return scope["BUILDS"]
    except Exception as exc:
        log(f"(could not re-read the build list: {exc!r}; using the current one)")
    return BUILDS


def bgit(*args):
    r = subprocess.run(["git", "-C", BUDGET_DIR, *args], capture_output=True, text=True)
    return r.returncode, r.stdout.strip()


def budget_pull():
    """Clone or update the shared build-control repo. Returns False when the budget is off or unreachable."""
    if not BUDGET_REPO:
        return False
    if not os.path.isdir(os.path.join(BUDGET_DIR, ".git")):
        r = subprocess.run(["git", "clone", "-q", BUDGET_REPO, BUDGET_DIR], capture_output=True, text=True)
        if r.returncode != 0:
            log(f"(build budget: could not clone {BUDGET_REPO}: {r.stderr.strip()[:200]})")
            return False
    code, _ = bgit("pull", "-q", "--rebase")
    if code != 0:
        log("(build budget: could not pull build-control; using the local copy)")
    return True


def week_start(now):
    """Monday 2:00 AM Eastern, the start of the current budget week."""
    start = (now - timedelta(days=now.weekday())).replace(hour=2, minute=0, second=0, microsecond=0)
    return start if now >= start else start - timedelta(days=7)


def budget_state():
    """(limit, used, warn_pct, override_on) for the current week, or None when there is no budget to enforce."""
    if not budget_pull():
        return None
    try:
        cfg = json.load(open(os.path.join(BUDGET_DIR, "budget.json")))
    except (OSError, ValueError) as exc:
        log(f"(build budget: budget.json unreadable: {exc!r}; budget off for this run)")
        return None
    now = datetime.now(TZ)
    start = week_start(now)
    used = 0
    try:
        for line in open(os.path.join(BUDGET_DIR, "usage.jsonl")):
            if line.strip():
                row = json.loads(line)
                if datetime.fromisoformat(row["at"]) >= start:
                    used += int(row.get("tokens") or 0)
    except FileNotFoundError:
        pass
    limit = cfg.get("weekly_limit_tokens")
    if not limit:
        log(f"(build budget: no weekly limit set yet; {used} tokens used this week; no hold)")
        return None
    ov = cfg.get("override_until")
    override_on = bool(ov) and datetime.fromisoformat(ov) > now
    return int(limit), used, int(cfg.get("warn_pct", 80)), override_on


def record_usage(name, result_event):
    """Append one usage line for a finished session to build-control and push it."""
    if not BUDGET_REPO or not result_event:
        return
    u = result_event.get("usage") or {}
    tokens = sum(int(u.get(k) or 0) for k in ("input_tokens", "cache_creation_input_tokens", "output_tokens"))
    row = {"at": datetime.now(TZ).isoformat(timespec="seconds"), "repo": os.path.basename(REPO), "build": name,
           "tokens": tokens, "cache_read_tokens": int(u.get("cache_read_input_tokens") or 0),
           "cost_usd_equiv": result_event.get("total_cost_usd"),
           "minutes": int((result_event.get("duration_ms") or 0) / 60000)}
    for attempt in range(3):
        if not budget_pull():
            return
        with open(os.path.join(BUDGET_DIR, "usage.jsonl"), "a") as f:
            f.write(json.dumps(row) + "\n")
        bgit("add", "usage.jsonl")
        bgit("commit", "-q", "-m", f"[skip ci] usage {row['repo']} {name} {tokens}")
        code, _ = bgit("push", "-q")
        if code == 0:
            log(f"{name}: usage recorded ({tokens} tokens)")
            return
        bgit("reset", "-q", "--hard", "@{u}")
    log(f"{name}: could not push usage to build-control after 3 tries; the tile will be short by {tokens} tokens")


def budget_allows(name):
    """Check before starting any session. False = hold: start nothing new."""
    st = budget_state()
    if st is None:
        return True
    limit, used, warn_pct, override_on = st
    pct = int(used * 100 / limit) if limit else 0
    if used >= limit and not override_on:
        log(f"HOLD: build budget reached ({used} of {limit} tokens this week, {pct}%). {name} was not started. "
            f"Work already finished is kept. Re-run after the Monday 2:00 AM reset, or after Josh overrides the hold.")
        return False
    if used >= limit:
        log(f"(build budget over the limit, {pct}%, but the hold is overridden; continuing)")
    elif pct >= warn_pct:
        log(f"(build budget at {pct}% of the weekly limit)")
    return True


def landed(name):
    git("fetch", "-q", "origin", "+refs/heads/main:refs/remotes/origin/main")
    return bool(git("log", "origin/main", "-E", f"--grep=^\\[Merge\\] {name} \\(", "--format=%h", "-1"))


def prompt_for(name, branch, spec, extra):
    return f"""Unattended run in a FRESH session, started by scripts/run_chain.py. Your job is ONLY build {name}.
1. Read CLAUDE.md, docs/claude/chain.md and the handoff sections your spec names. If {spec} is not on main, bring it
   from origin/{PLAN_BRANCH} with your first commit.
2. git fetch origin. If origin/{branch} exists: check it out, report git status (never discard uncommitted work), read
   docs/sessions/{name}-status.md and continue from PICK UP HERE. Otherwise create {branch} from origin/main and the
   status file with a RESUME block quoting the spec's section 0 and this prompt verbatim.
3. Build {spec} per docs/process.md section 4 (decide and log; hard stops only). Commit and push the feature branch
   after every step. ONE deliberate CI run. Keep a tool call printing output at least every 20 minutes.
4. {GRANT_BASE} {extra}
5. Land per the landing rule as adapted in CLAUDE.md (handoff section 7.5). The merge commit message MUST start with
   "[Merge] {name} (". The Mac mini updater deploys and smoke-checks after the merge (handoff section 7.4). Record the
   landing in chain.md and the status file.
6. Then STOP. Do not start the next build. If a hard stop or a question for Josh blocks landing, write it in the status
   file's Questions section (plain text, full question, options, recommendation), push, and end. If the status file
   already holds questions with NO recorded answer, change nothing and end at once, saying so: Josh answers through the
   chat session or the Command Center dashboard, which record the answers in the status file.
"""


def run_session(name, branch, spec, extra):
    env = {k: v for k, v in os.environ.items() if k not in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")}
    cmd = ["claude", "-p", prompt_for(name, branch, spec, extra), "--dangerously-skip-permissions",
           "--output-format", "stream-json", "--verbose"]
    started, last, done = time.time(), [time.time()], threading.Event()

    def beat():
        while not done.wait(60):
            if time.time() - last[0] >= HEARTBEAT_SECONDS:
                log(f"{name}: still running ({int((time.time() - started) / 60)} min)")
                last[0] = time.time()

    threading.Thread(target=beat, daemon=True).start()
    proc = subprocess.Popen(cmd, cwd=REPO, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    result_event = None
    try:
        for line in proc.stdout:
            last[0] = time.time()
            line = line.strip()
            if not line:
                continue
            try:
                ev = json.loads(line)
            except json.JSONDecodeError:
                log(f"{name}: {line[:300]}")
                continue
            if ev.get("type") == "assistant":
                for b in (ev.get("message") or {}).get("content") or []:
                    if b.get("type") == "text" and b.get("text", "").strip():
                        log(f"{name}: {b['text'].strip()[:300]}")
                    elif b.get("type") == "tool_use":
                        log(f"{name}: [tool] {b.get('name')}")
            elif ev.get("type") == "result":
                result_event = ev
                log(f"{name}: session ended: {ev.get('subtype')}, error={ev.get('is_error')}, "
                    f"{ev.get('num_turns')} turns, {int((ev.get('duration_ms') or 0) / 60000)} min")
                if ev.get("result"):
                    log(f"{name}: final message:\n{ev['result']}")
        proc.wait()
        log(f"{name}: claude exited with code {proc.returncode}")
    finally:
        done.set()
        record_usage(name, result_event)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="start")
    ap.add_argument("--only")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not args.dry_run and not shutil.which("claude"):
        log("The `claude` command is not installed. Install Claude Code, run `claude` once to sign in, then re-run.")
        return 2
    seen = set()
    while True:
        builds = BUILDS if (args.dry_run or args.only) else latest_builds()
        names = [b[0] for b in builds]
        if args.only:
            builds = [b for b in builds if b[0] == args.only]
        elif args.start in names:
            builds = builds[names.index(args.start):]
        pending = [b for b in builds if b[0] not in seen]
        if not pending:
            break
        name, branch, spec, extra = pending[0]
        seen.add(name)
        if landed(name):
            log(f"{name}: already landed on main, skipping")
            continue
        if args.dry_run:
            log(f"{name}: would start a fresh session (branch {branch})")
            continue
        for attempt in (1, 2):
            if not budget_allows(name):
                return 3
            log(f"{name}: starting fresh session (attempt {attempt})")
            try:
                run_session(name, branch, spec, extra)
            except Exception as exc:
                log(f"{name}: session failed: {exc!r}")
            if landed(name):
                log(f"{name}: LANDED on main")
                break
            log(f"{name}: not landed after attempt {attempt}")
        else:
            log(f"{name}: not landed after 2 sessions. STOPPING. Read docs/sessions/{name}-status.md (Questions) on "
                f"origin/{branch}. If a session ended on a usage limit, re-run later.")
            return 1
    log("All builds in this run have landed." if not args.dry_run else "Dry run only; nothing was started.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
