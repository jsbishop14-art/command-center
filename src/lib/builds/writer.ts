import { commit, readFile, BUILD_CONTROL_REPO } from "./github";
import { statusPath, parseQuestions } from "./state";
import type { Commit } from "./types";

// The only writes the app makes to GitHub (spec §3, handoff §11 check 4): answers (a status file and
// chain.md on the build branch, one commit, [skip ci]) and the build budget (budget.json in
// build-control). Every write goes through github.commit(), which enforces the path allowlist, so
// nothing else can reach GitHub.

const CHAIN_PATH = "docs/claude/chain.md";

export type AnswerInput = {
  repo: string;
  branch: string;
  buildName: string;
  questionId: string;
  questionNumber: number;
  by: string; // acting user's display name (handoff §7.1 writes "Answer — Josh, …")
  at: string; // Eastern timestamp (nowEastern())
  answer: string; // Josh's words, verbatim
};

export class AnswerError extends Error {}

// Insert `Answer — <by>, <at> (verbatim): "<answer>"` directly under the question, after its
// recommendation (handoff §7.1). Returns the new status-file content. Throws if the question or its
// recommendation line is not found, so an answer is never written to the wrong place.
export function insertAnswerLine(status: string, input: AnswerInput): string {
  const answerLine = `Answer — ${input.by}, ${input.at} (verbatim): "${input.answer}"`;
  const lines = status.split("\n");
  const headerIdx = lines.findIndex(
    (l) => /^Q\d+\./.test(l.trim()) && l.includes(`[${input.questionId}]`),
  );
  if (headerIdx === -1) throw new AnswerError(`Question ${input.questionId} not found in the status file.`);
  // Find this question's recommendation line, stopping at the next question header.
  let recIdx = -1;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (/^Q\d+\./.test(lines[i].trim())) break;
    if (/^My recommendation:/i.test(lines[i].trim())) {
      recIdx = i;
      break;
    }
  }
  if (recIdx === -1) throw new AnswerError(`Recommendation for ${input.questionId} not found.`);
  // Skip the recommendation's continuation lines (non-blank, not a new Q / Options / Answer).
  let insertAt = recIdx + 1;
  while (
    insertAt < lines.length &&
    lines[insertAt].trim().length > 0 &&
    !/^Q\d+\./.test(lines[insertAt].trim()) &&
    !/^Options:/i.test(lines[insertAt].trim()) &&
    !/^Answer\s+—/.test(lines[insertAt].trim())
  ) {
    insertAt++;
  }
  lines.splice(insertAt, 0, answerLine);
  return lines.join("\n");
}

// The matching ruling in the repo's chain.md, in the same commit (process.md §9 / CLAUDE §9). Appends
// under a "## Rulings in force" section, creating chain.md and the section if absent.
export function appendChainRuling(chain: string | null, input: AnswerInput): string {
  const ruling = `- ${input.at}, answer to [${input.questionId}] (${input.buildName}): "${input.answer}"`;
  if (!chain || chain.trim().length === 0) {
    return `# chain.md\n\n## Rulings in force\n\n${ruling}\n`;
  }
  const marker = "## Rulings in force";
  if (chain.includes(marker)) {
    const idx = chain.indexOf(marker) + marker.length;
    // Insert the ruling as the first entry under the heading.
    const before = chain.slice(0, idx);
    const after = chain.slice(idx).replace(/^\n+/, "\n\n");
    return `${before}${after.startsWith("\n") ? "" : "\n\n"}${ruling}${after}`;
  }
  return `${chain.replace(/\s*$/, "")}\n\n${marker}\n\n${ruling}\n`;
}

// Write an answer: the status file and chain.md on the build branch, one commit, [skip ci] (check 3).
export function commitAnswer(input: AnswerInput): Commit {
  const status = readFile(input.repo, input.branch, statusPath(input.buildName));
  if (status === null) throw new AnswerError(`Status file for ${input.buildName} not found.`);
  // Guard against answering a question that is already answered.
  const existing = parseQuestions(status).find((q) => q.id === input.questionId);
  if (existing?.answer) throw new AnswerError(`Question ${input.questionId} is already answered.`);
  const newStatus = insertAnswerLine(status, input);
  const chain = readFile(input.repo, input.branch, CHAIN_PATH);
  const newChain = appendChainRuling(chain, input);
  return commit(
    input.repo,
    input.branch,
    [
      { path: statusPath(input.buildName), content: newStatus },
      { path: CHAIN_PATH, content: newChain },
    ],
    `Answer ${input.questionId} — ${input.by} [skip ci]`,
    input.by,
  );
}

// Write the build budget (process.md §12). Merges the given fields into build-control/budget.json.
export type BudgetWrite = {
  weeklyLimitTokens?: number | null;
  warnPct?: number;
  overrideUntil?: string | null;
};

export function commitBudget(write: BudgetWrite, by: string): Commit {
  const raw = readFile(BUILD_CONTROL_REPO, "main", "budget.json");
  let cfg: { weekly_limit_tokens: number | null; warn_pct: number; override_until: string | null } = {
    weekly_limit_tokens: null,
    warn_pct: 80,
    override_until: null,
  };
  if (raw) {
    try {
      cfg = { ...cfg, ...(JSON.parse(raw) as typeof cfg) };
    } catch {
      // keep defaults on a malformed file
    }
  }
  if (write.weeklyLimitTokens !== undefined) cfg.weekly_limit_tokens = write.weeklyLimitTokens;
  if (write.warnPct !== undefined) cfg.warn_pct = write.warnPct;
  if (write.overrideUntil !== undefined) cfg.override_until = write.overrideUntil;
  return commit(
    BUILD_CONTROL_REPO,
    "main",
    [{ path: "budget.json", content: JSON.stringify(cfg, null, 2) }],
    `Build budget update [skip ci]`,
    by,
  );
}
