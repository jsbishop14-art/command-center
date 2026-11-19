import { getDb } from "@/lib/db";
import { easternStamp } from "@/lib/kanban/time";
import { BUILD_CONTROL_REPO, CHAIN_BRANCH, CHAIN_PATH } from "./github";

// The stub GitHub state (handoff §7.5, spec §6). Six tracked projects plus build-control, seeded once
// into builds_files / builds_commits so the Builds screen has realistic data to read without any real
// GitHub call. It deliberately exercises every stage (Queued, Building, Needs Josh, Landed), the
// answers-saved state, the chain positions, and a build budget over its limit (HOLD on), matching the
// layout in docs/mockup/Builds.dc.html. The Mac mini uses CC_LIVE_GITHUB=1 and reads real GitHub
// instead; this fixture never loads there.

type FixtureQuestion = {
  n: number;
  text: string;
  options: { key: string; text: string }[];
  rec: string;
  answer?: { by: string; at: string; text: string };
};
type FixtureBuild = {
  name: string;
  landed?: boolean;
  branch?: string; // set when the build branch has been created (started / Building / Needs Josh)
  pickUpHere?: string;
  questions?: FixtureQuestion[];
  hoursAgo?: number; // last activity / merge, in hours before seed time
};
type FixtureProject = { name: string; repo: string; builds: FixtureBuild[] };

// The branch name the runner uses for a build (handoff §7.1): the started builds carry an explicit
// one; the rest get a deterministic slug so the chain is complete but their branch does not exist.
function branchFor(repo: string, b: FixtureBuild): string {
  if (b.branch) return b.branch;
  return `${repo}-${b.name.toLowerCase()}`;
}

// Hours → an Eastern timestamp that many hours before now.
function ago(hours: number): string {
  return easternStamp(new Date(Date.now() - hours * 3600_000));
}

// Build a status file in process.md shape (PICK UP HERE + Questions), parseable by state.ts.
function statusFile(b: FixtureBuild): string {
  const lines: string[] = [`# ${b.name} status`, "", "## PICK UP HERE", "", b.pickUpHere ?? "Building."];
  lines.push("", "## Questions", "");
  if (!b.questions || b.questions.length === 0) {
    lines.push("(none)");
  } else {
    for (const q of b.questions) {
      const opts = q.options.map((o) => `${o.key}) ${o.text}`).join("  ");
      lines.push(`Q${q.n}. [${asId(b.name, q.n)}] ${q.text}`);
      lines.push(`Options: ${opts}`);
      lines.push(`My recommendation: ${q.rec}`);
      if (q.answer) {
        lines.push(`Answer — ${cap(q.answer.by)}, ${q.answer.at} (verbatim): "${q.answer.text}"`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

function asId(buildName: string, n: number): string {
  return `${buildName.toUpperCase().replace(/[^A-Z0-9]+/g, "")}-ASK-${n}`;
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const FIXTURE: FixtureProject[] = [
  {
    name: "Command Center",
    repo: "command-center",
    builds: [
      { name: "CC1", landed: true, hoursAgo: 220 },
      { name: "CC2", landed: true, hoursAgo: 210 },
      { name: "CC3", landed: true, hoursAgo: 200 },
      { name: "CC4", landed: true, hoursAgo: 190 },
      { name: "CC5", landed: true, hoursAgo: 180 },
      { name: "CC6", landed: true, hoursAgo: 170 },
      { name: "CC7", landed: true, hoursAgo: 160 },
      {
        name: "CC8",
        branch: "cc8-builds",
        hoursAgo: 1,
        pickUpHere: "Builds screen in progress: GitHub stub, state derivation and the budget tile.",
      },
      { name: "CC9" },
      { name: "CC10" },
    ],
  },
  {
    name: "EZ Binder API",
    repo: "ez-binder",
    builds: [
      { name: "S155", landed: true, hoursAgo: 120 },
      { name: "S156", landed: true, hoursAgo: 90 },
      {
        name: "S157",
        branch: "s157-changes-feed",
        hoursAgo: 2,
        pickUpHere: "Blocked on two decisions before the /changes cursor format is fixed.",
        questions: [
          {
            n: 1,
            text: "Should the /changes cursor be an opaque string or the last updated_at timestamp?",
            options: [
              { key: "A", text: "Opaque cursor the server defines." },
              { key: "B", text: "The last updated_at timestamp, ISO 8601." },
            ],
            rec: "A — an opaque cursor lets the server change its paging without breaking clients.",
          },
          {
            n: 2,
            text: "How long should a webhook signing secret stay valid after rotation?",
            options: [
              { key: "A", text: "Old secret rejected immediately on rotation." },
              { key: "B", text: "Both secrets accepted for 24 hours." },
              { key: "C", text: "Both secrets accepted for 7 days." },
            ],
            rec: "B — 24 hours covers a deploy window without a long overlap.",
          },
        ],
      },
      { name: "S158" },
    ],
  },
  {
    name: "Blueprint Creator",
    repo: "blueprint-creator",
    builds: [
      { name: "BP1", landed: true, hoursAgo: 300 },
      {
        name: "BP2",
        branch: "bp2-layers",
        hoursAgo: 5,
        pickUpHere: "Answers saved; waiting for the runner to resume BP2.",
        questions: [
          {
            n: 1,
            text: "Store layer order per drawing or per project?",
            options: [
              { key: "A", text: "Per drawing." },
              { key: "B", text: "Per project, with a per-drawing override." },
            ],
            rec: "B — most drawings in a project share an order.",
            answer: { by: "josh", at: "2026-11-18 09:40", text: "B" },
          },
        ],
      },
      { name: "BP3" },
    ],
  },
  {
    name: "EZ Draft",
    repo: "ez-draft",
    builds: [
      { name: "ED1", landed: true, hoursAgo: 400 },
      { name: "ED2", landed: true, hoursAgo: 40 },
    ],
  },
  {
    name: "FrameFocus",
    repo: "frame-focus",
    builds: [{ name: "FF1" }, { name: "FF2" }, { name: "FF3" }],
  },
  {
    name: "Popcorn Pilot",
    repo: "popcorn-pilot",
    builds: [{ name: "PP1" }, { name: "PP2" }],
  },
];

// The default tracked-projects list (handoff §7.1), used by projects.ts when Josh has not edited it.
export const DEFAULT_PROJECTS = FIXTURE.map((p) => ({ name: p.name, repo: p.repo }));

// build-control budget: over the limit with no override, so HOLD is on and the next queued build on
// each project shows "held by budget" (mockup). Josh sets the real limit (chain.md 2026-11-09 16:39).
function budgetJson(): string {
  return JSON.stringify({ weekly_limit_tokens: 40_000_000, warn_pct: 80, override_until: null }, null, 2);
}

// usage.jsonl: this week's build sessions, summing to just over the 40M limit (HOLD on).
function usageJsonl(): string {
  const rows = [
    { at: ago(30), repo: "ez-binder", build: "S156", tokens: 12_000_000, cache_read_tokens: 90_000_000, cost_usd_equiv: 410.0, minutes: 140 },
    { at: ago(20), repo: "command-center", build: "CC7", tokens: 9_500_000, cache_read_tokens: 70_000_000, cost_usd_equiv: 320.0, minutes: 95 },
    { at: ago(8), repo: "blueprint-creator", build: "BP2", tokens: 11_000_000, cache_read_tokens: 60_000_000, cost_usd_equiv: 360.0, minutes: 120 },
    { at: ago(2), repo: "command-center", build: "CC8", tokens: 8_200_000, cache_read_tokens: 55_000_000, cost_usd_equiv: 270.0, minutes: 80 },
  ];
  return rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

const SEED_MARKER = { repo: "__stub__", branch: "__meta__", path: "seeded" };

export function buildsStubSeeded(): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM builds_files WHERE repo = ? AND branch = ? AND path = ?")
    .get(SEED_MARKER.repo, SEED_MARKER.branch, SEED_MARKER.path);
  return !!row;
}

// Seed the modelled GitHub once. Idempotent: a marker row short-circuits repeat calls, so reads can
// call it freely. Never run on the Mac mini (reads there go straight to the live API).
export function ensureBuildsStub(): void {
  const db = getDb();
  if (buildsStubSeeded()) return;
  const putFile = db.prepare(
    `INSERT INTO builds_files (repo, branch, path, content, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(repo, branch, path) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
  );
  const putCommit = db.prepare(
    `INSERT INTO builds_commits (repo, branch, sha, message, author, committed_at, paths)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  let n = 0;
  const sha = () => `stub${String(n++).padStart(36, "0")}`;
  const tx = db.transaction(() => {
    for (const p of FIXTURE) {
      const chain = p.builds.map((b) => ({ name: b.name, branch: branchFor(p.repo, b) }));
      putFile.run(p.repo, CHAIN_BRANCH, CHAIN_PATH, JSON.stringify(chain), ago(500));
      for (const b of p.builds) {
        if (b.landed) {
          const at = ago(b.hoursAgo ?? 100);
          putCommit.run(p.repo, "main", sha(), `[Merge] ${b.name} (landed)`, "runner", at, "[]");
        }
        if (b.branch) {
          const at = ago(b.hoursAgo ?? 1);
          putFile.run(p.repo, b.branch, `docs/sessions/${b.name}-status.md`, statusFile(b), at);
          putCommit.run(
            p.repo,
            b.branch,
            sha(),
            `${b.name} step: work in progress [skip ci]`,
            "runner",
            at,
            JSON.stringify([`docs/sessions/${b.name}-status.md`]),
          );
        }
      }
    }
    // build-control.
    putFile.run(BUILD_CONTROL_REPO, "main", "budget.json", budgetJson(), ago(48));
    putFile.run(BUILD_CONTROL_REPO, "main", "usage.jsonl", usageJsonl(), ago(2));
    putFile.run(SEED_MARKER.repo, SEED_MARKER.branch, SEED_MARKER.path, "1", ago(500));
  });
  tx();
}
