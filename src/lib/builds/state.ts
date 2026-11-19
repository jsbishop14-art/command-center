import { readChain, readFile, listCommits, branchExists } from "./github";
import type { Build, BudgetState, Project, ProjectCard, Question, QuestionOption, Stage } from "./types";

// Derive the state of every tracked build from GitHub (handoff §7.1). Nothing here calls Claude or
// makes any outside call beyond the (stubbed) GitHub reads.

export function statusPath(buildName: string): string {
  return `docs/sessions/${buildName}-status.md`;
}

// The runner command Josh pastes to resume a build (process.md §2 step 4, mockup "Restart the
// runner"). Per project workspace, keyed by the repo's folder name.
export function runnerCommand(repo: string): string {
  const dir = repo.includes("/") ? repo.split("/").pop()! : repo;
  return (
    `cd ${dir} && git fetch -q origin docs/next-builds && ` +
    `git show origin/docs/next-builds:scripts/run_chain.py > ~/run_chain.py && python3 ~/run_chain.py`
  );
}

// ---- Status-file parsing (process.md §5 / CLAUDE §5 shape) -------------------------------------

function sectionBody(content: string, heading: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      const title = line.replace(/^##\s+/, "").trim().toLowerCase();
      inSection = title === heading.toLowerCase();
      continue;
    }
    if (inSection) out.push(line);
  }
  return out.join("\n").trim();
}

export function parsePickUpHere(content: string): string | null {
  const body = sectionBody(content, "PICK UP HERE");
  if (!body) return null;
  const first = body.split("\n").find((l) => l.trim().length > 0);
  return first ? first.trim() : null;
}

function parseOptions(line: string): QuestionOption[] {
  const text = line.replace(/^Options:\s*/i, "");
  const out: QuestionOption[] = [];
  const re = /([A-Z])\)\s*(.*?)(?=\s+[A-Z]\)|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ key: m[1], text: m[2].trim() });
  }
  return out;
}

export function parseQuestions(content: string): Question[] {
  const body = sectionBody(content, "Questions");
  if (!body || /^\(none\)/i.test(body)) return [];
  const lines = body.split("\n");
  const questions: Question[] = [];
  let cur: Question | null = null;
  let mode: "text" | "rec" | null = null;
  const push = () => {
    if (cur) questions.push(cur);
    cur = null;
    mode = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    const qm = line.match(/^Q(\d+)\.\s*(?:\[([A-Za-z0-9._-]+)\]\s*)?(.*)$/);
    if (qm) {
      push();
      cur = {
        id: qm[2] ?? `Q${qm[1]}`,
        number: Number(qm[1]),
        text: qm[3].trim(),
        options: [],
        recommendation: "",
        answer: null,
      };
      mode = "text";
      continue;
    }
    if (!cur) continue;
    if (/^Options:/i.test(line)) {
      cur.options = parseOptions(line);
      mode = null;
      continue;
    }
    if (/^My recommendation:/i.test(line)) {
      cur.recommendation = line.replace(/^My recommendation:\s*/i, "").trim();
      mode = "rec";
      continue;
    }
    const am = line.match(/^Answer\s+—\s+(\w+),\s+(.+?)\s+\(verbatim\):\s*"([\s\S]*)"\s*$/);
    if (am) {
      cur.answer = { by: am[1].toLowerCase(), at: am[2].trim(), text: am[3] };
      mode = null;
      continue;
    }
    if (line.length === 0) {
      mode = null;
      continue;
    }
    if (mode === "text") cur.text = `${cur.text} ${line}`.trim();
    else if (mode === "rec") cur.recommendation = `${cur.recommendation} ${line}`.trim();
  }
  push();
  return questions;
}

// ---- Build & project derivation ----------------------------------------------------------------

function mergePrefix(name: string): string {
  return `[Merge] ${name} (`;
}

export function deriveBuild(repo: string, name: string, branch: string, position: number): Build {
  const mains = listCommits(repo, "main");
  const merge = mains.find((c) => c.message.startsWith(mergePrefix(name)));
  const landed = !!merge;
  const hasBranch = branch.length > 0 && branchExists(repo, branch);

  let questions: Question[] = [];
  let pickUpHere: string | null = null;
  let branchActivity: string | null = null;
  if (hasBranch) {
    const status = readFile(repo, branch, statusPath(name));
    if (status) {
      questions = parseQuestions(status);
      pickUpHere = parsePickUpHere(status);
    }
    branchActivity = listCommits(repo, branch)[0]?.committedAt ?? null;
  }

  const unanswered = questions.filter((q) => q.answer === null);
  const stage: Stage = landed
    ? "Landed"
    : hasBranch
      ? unanswered.length > 0
        ? "Needs Josh"
        : "Building"
      : "Queued";

  return {
    name,
    position,
    stage,
    landed,
    mergeSha: merge?.sha ?? null,
    mergeAt: merge?.committedAt ?? null,
    branch: hasBranch ? branch : null,
    lastActivityAt: branchActivity ?? merge?.committedAt ?? null,
    pickUpHere,
    questions,
    heldByBudget: false, // set by deriveProject for the current queued build
  };
}

function hoursSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const h = (now.getTime() - new Date(iso).getTime()) / 3_600_000;
  return h >= 0 ? h : null;
}

export type UpdaterView = {
  live: { merge: string; at: string | null } | null;
  rolledBack: { at: string; message: string; log: string } | null;
};

export function deriveProject(
  project: Project,
  budget: BudgetState,
  now: Date = new Date(),
  updater?: UpdaterView,
): ProjectCard {
  const chain = readChain(project.repo);
  const builds = chain.map((e, i) => deriveBuild(project.repo, e.name, e.branch, i + 1));
  const landedBuilds = builds.filter((b) => b.landed);
  const landedCount = landedBuilds.length;
  const totalCount = builds.length;

  const current = builds.find((b) => !b.landed) ?? null;
  const unansweredCount = current ? current.questions.filter((q) => q.answer === null).length : 0;
  const needsJosh = unansweredCount > 0;
  const answersSaved =
    !!current &&
    current.stage === "Building" &&
    current.questions.length > 0 &&
    unansweredCount === 0;

  let stage: ProjectCard["stage"];
  if (!current) {
    stage = "Landed";
  } else if (current.stage === "Queued" && budget.hold) {
    stage = "Queued · held by budget";
    current.heldByBudget = true;
  } else {
    stage = current.stage;
  }

  const lastLandedBuild =
    landedBuilds.length > 0
      ? landedBuilds.reduce((a, b) => ((b.mergeAt ?? "") > (a.mergeAt ?? "") ? b : a))
      : null;

  const lastActivityAt = current?.lastActivityAt ?? lastLandedBuild?.mergeAt ?? null;
  const activeStage = stage === "Building" || stage === "Needs Josh";
  const sinceH = activeStage ? hoursSince(lastActivityAt, now) : null;
  const noActivityHours = sinceH !== null && sinceH >= 3 ? Math.round(sinceH) : null;

  const queueLabel =
    landedCount === 0 ? `${totalCount} queued` : `${landedCount} of ${totalCount} builds landed`;

  return {
    name: project.name,
    repo: project.repo,
    landedCount,
    totalCount,
    current,
    stage,
    queueLabel,
    lastLanded: lastLandedBuild ? { name: lastLandedBuild.name, at: lastLandedBuild.mergeAt } : null,
    lastActivityAt,
    noActivityHours,
    needsJosh,
    unansweredCount,
    answersSaved,
    runnerCommand: answersSaved ? runnerCommand(project.repo) : null,
    live: updater?.live ?? null,
    rolledBack: updater?.rolledBack ?? null,
  };
}
