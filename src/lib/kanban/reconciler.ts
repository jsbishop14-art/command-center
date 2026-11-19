import fs from "node:fs";
import path from "node:path";
import { parse, type FMValue } from "./frontmatter";
import { parseCard, serializeCard, cardSnapshotFields, type Card } from "./card";
import {
  ensureLayout,
  writeNewCard,
  readCardFile,
  listCardIds,
  atomicWrite,
} from "./store";
import { newDir, cardsDir, cardFile, archiveDir, contextFile } from "./paths";
import { loadConfig } from "./boardyaml";
import { diff, logCardChange } from "./activity";
import {
  nextCardId,
  recordProblem,
  clearProblem,
  getSnapshot,
  putSnapshot,
  deleteSnapshot,
  listNewFiles,
  getSetting,
  setSetting,
} from "./state";
import { writeAgents, writeContext } from "./generate";
import { nowEastern, daysBetween } from "./time";
import { commitKanban, isKanbanRepo } from "./git";
import type { Actor, Board, Stage, Source } from "./types";

// The reconciler keeps the app's view (log, snapshots, Problems, context, AGENTS.md) in step with
// the kanban files (handoff §4.9). It runs as a short-interval poll rather than fs.watch: polling
// is more robust on macOS and across editors, and a sub-second poll still meets the "within a
// second / within 2 seconds" checks (handoff §11). Because the app updates its snapshot the moment
// it writes a file, a self-write produces no diff — so it never logs its own writes twice.

const ARCHIVE_DAYS = 30;
const COMMIT_INTERVAL_MS = 60 * 60 * 1000; // hourly when something changed (handoff §4.10)

function reason(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function asScalar(v: FMValue): string | null {
  if (v === null) return null;
  if (Array.isArray(v)) return v.join(", ");
  return v;
}
function asList(v: FMValue): string[] {
  if (v === null) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

// A source_ref already represented in cards/, new/ or archive/ (handoff §4.7 rule 7).
export function sourceRefExists(ref: string, exceptId?: string): boolean {
  for (const id of listCardIds()) {
    if (id === exceptId) continue;
    try {
      const c = readCardFile(id);
      if (c?.source_ref && c.source_ref === ref) return true;
    } catch {
      // ignore invalid files here
    }
  }
  // archive
  const archiveRoot = path.join(cardsDir(), "..", "archive");
  if (fs.existsSync(archiveRoot)) {
    for (const year of fs.readdirSync(archiveRoot)) {
      const yd = path.join(archiveRoot, year);
      if (!fs.statSync(yd).isDirectory()) continue;
      for (const f of fs.readdirSync(yd)) {
        if (!f.endsWith(".md")) continue;
        try {
          const c = parseCard(fs.readFileSync(path.join(yd, f), "utf8"), f);
          if (c.source_ref === ref) return true;
        } catch {
          // ignore
        }
      }
    }
  }
  return false;
}

// Next order value for a stage column (handoff §4.2: spaced numbers; new card goes to the end).
export function nextOrder(stage: Stage): number {
  let max = 0;
  for (const id of listCardIds()) {
    try {
      const c = readCardFile(id);
      if (c && c.stage === stage) max = Math.max(max, c.order);
    } catch {
      // ignore
    }
  }
  return max + 1000;
}

// Build a complete, valid card from a new/ file's frontmatter, filling the fields the app owns
// (id, order, timestamps) with sensible defaults. Throws (-> Problems) if a required field like
// title is missing. Validated by a serialize/parse round-trip.
export function cardFromNew(data: Record<string, FMValue>, body: string, id: string, at: string): Card {
  const stage = (asScalar(data.stage) || "inbox") as Stage;
  const created = asScalar(data.created) || at;
  const draft: Card = {
    id,
    title: asScalar(data.title) || "",
    stage,
    boards: (asList(data.boards).length ? asList(data.boards) : ["josh"]) as Board[],
    area: (asScalar(data.area) || "business") as Card["area"],
    project: asScalar(data.project),
    due: asScalar(data.due),
    order: data.order != null ? Number(asScalar(data.order)) : nextOrder(stage),
    created,
    updated: at,
    created_by: (asScalar(data.created_by) || "claude") as Actor,
    source: (asScalar(data.source) || "sync") as Source,
    source_ref: asScalar(data.source_ref),
    waiting_on: asScalar(data.waiting_on),
    waiting_since: asScalar(data.waiting_since),
    done_at: asScalar(data.done_at),
    discarded_at: asScalar(data.discarded_at),
    last_actor: (asScalar(data.created_by) || "claude") as Actor,
    last_run: asScalar(data.last_run),
    notes: body,
    extra: {},
    extraOrder: [],
  };
  // Preserve unknown frontmatter keys from the new file.
  const known = new Set<string>([
    "id", "title", "stage", "boards", "area", "project", "due", "order",
    "created", "updated", "created_by", "source", "source_ref", "waiting_on",
    "waiting_since", "done_at", "discarded_at", "last_actor", "last_run",
  ]);
  for (const k of Object.keys(data)) {
    if (!known.has(k)) {
      draft.extra[k] = data[k];
      draft.extraOrder.push(k);
    }
  }
  // Validate by round-trip; throws with a plain reason if anything is wrong.
  return parseCard(serializeCard(draft), `${id}.md`);
}

export type ReconcileResult = {
  created: string[];
  changed: string[];
  archived: string[];
  problems: number;
};

export function reconcile(opts?: { now?: string }): ReconcileResult {
  ensureLayout();
  loadConfig(); // creates board.yaml on first run, migrates an older schema
  writeAgents(); // keep AGENTS.md current with board.yaml + the rules
  const at = opts?.now ?? nowEastern();
  const result: ReconcileResult = { created: [], changed: [], archived: [], problems: 0 };

  // 1. Pick up new/ files: assign the next id, move to cards/, log create (handoff §4.3).
  for (const fname of listNewFiles()) {
    const full = path.join(newDir(), fname);
    const rel = `new/${fname}`;
    try {
      const doc = parse(fs.readFileSync(full, "utf8"));
      const ref = asScalar(doc.data.source_ref);
      if (ref && sourceRefExists(ref)) {
        // Duplicate of an existing card: drop without creating (handoff §4.7 rule 7).
        fs.rmSync(full);
        clearProblem(rel);
        continue;
      }
      const id = nextCardId();
      const card = cardFromNew(doc.data, doc.body, id, at);
      writeNewCard(card);
      fs.rmSync(full);
      clearProblem(rel);
      logCardChange({ beforeFields: null, card, actor: card.created_by, run: card.last_run, at });
      putSnapshot(id, cardSnapshotFields(card), card.updated, at);
      writeContext(card);
      result.created.push(id);
    } catch (e) {
      recordProblem(rel, reason(e), at);
      result.problems++;
    }
  }

  // 2. Scan cards/: validate, surface Problems, log direct changes against the snapshot (§4.6).
  for (const id of listCardIds()) {
    const rel = `cards/${id}.md`;
    let card: Card;
    try {
      card = readCardFile(id)!;
    } catch (e) {
      recordProblem(rel, reason(e), at);
      result.problems++;
      continue;
    }
    clearProblem(rel);
    const snap = getSnapshot(id);
    const beforeFields = snap ? snap.fields : null;
    const d = diff(beforeFields, card);
    if (!snap || d.changed.length > 0) {
      // A direct change that did not update last_actor/last_run is logged as actor unknown (§4.6).
      let actor = card.last_actor;
      if (
        snap &&
        d.changed.length > 0 &&
        snap.fields.last_actor === card.last_actor &&
        snap.fields.last_run === card.last_run
      ) {
        actor = "unknown";
      }
      const entry = logCardChange({ beforeFields, card, actor, run: card.last_run, at });
      if (entry) {
        result.changed.push(id);
        writeContext(card);
      }
      putSnapshot(id, cardSnapshotFields(card), card.updated, at);
    }
  }

  // 3. Archive Done and discarded cards older than 30 days (handoff §4.9).
  for (const id of listCardIds()) {
    let card: Card;
    try {
      card = readCardFile(id)!;
    } catch {
      continue;
    }
    const stamp = card.stage === "done" ? card.done_at : card.stage === "discarded" ? card.discarded_at : null;
    if (!stamp) continue;
    if (daysBetween(at, stamp) >= ARCHIVE_DAYS) {
      archiveCardFile(card, at);
      result.archived.push(id);
    }
  }

  // 4. Hourly git backup when something changed (handoff §4.10). Sync-triggered commits arrive CC7.
  maybeHourlyCommit(at);

  return result;
}

const LAST_COMMIT_KEY = "last_kanban_commit_ms";

function maybeHourlyCommit(at: string): void {
  if (!isKanbanRepo()) return;
  const nowMs = new Date(at).getTime();
  const last = Number(getSetting(LAST_COMMIT_KEY) || "0");
  if (nowMs - last < COMMIT_INTERVAL_MS) return;
  const made = commitKanban(`kanban: hourly backup ${at}`);
  if (made) setSetting(LAST_COMMIT_KEY, String(nowMs));
}

// Move a card file into archive/<year>/ and log the archive (handoff §4.9). The year comes from the
// done/discarded timestamp.
export function archiveCardFile(card: Card, at: string): void {
  const stamp = card.stage === "done" ? card.done_at : card.discarded_at;
  const year = (stamp || at).slice(0, 4);
  const destDir = archiveDir(year);
  fs.mkdirSync(destDir, { recursive: true });
  const text = serializeCard(card);
  atomicWrite(path.join(destDir, `${card.id}.md`), text);
  fs.rmSync(cardFile(card.id));
  logCardChange({
    beforeFields: getSnapshot(card.id)?.fields ?? null,
    card,
    actor: "unknown",
    at,
    forceAction: "archive",
  });
  deleteSnapshot(card.id);
}

// Restore an archived card back to cards/ (handoff §4.9 "restore works"). A restored card is
// re-opened to the Inbox stage with its done/discarded stamps cleared, so it shows on the board
// again and is not immediately re-archived.
export function restoreCard(id: string, at: string = nowEastern(), actor: Actor = "josh"): Card {
  // Find the archived file.
  const archiveRoot = path.join(cardsDir(), "..", "archive");
  let src: string | null = null;
  if (fs.existsSync(archiveRoot)) {
    for (const year of fs.readdirSync(archiveRoot)) {
      const candidate = path.join(archiveRoot, year, `${id}.md`);
      if (fs.existsSync(candidate)) {
        src = candidate;
        break;
      }
    }
  }
  if (!src) throw new Error(`archived card ${id} not found`);
  const card = parseCard(fs.readFileSync(src, "utf8"), `${id}.md`);
  const reopened: Card = {
    ...card,
    stage: "inbox",
    done_at: null,
    discarded_at: null,
    updated: at,
    last_actor: actor,
  };
  atomicWrite(cardFile(id), serializeCard(reopened));
  fs.rmSync(src);
  logCardChange({ beforeFields: null, card: reopened, actor, at, forceAction: "restore" });
  putSnapshot(id, cardSnapshotFields(reopened), reopened.updated, at);
  writeContext(reopened);
  return reopened;
}

// ---- The polling loop (singleton per server process) ------------------------------------------

const RECONCILE_MS = 500;
const g = globalThis as unknown as { __ccReconcileTimer?: ReturnType<typeof setInterval> };

export function startReconciler(): void {
  if (g.__ccReconcileTimer) return;
  // Run one pass immediately so the first page load is current, then poll.
  try {
    reconcile();
  } catch {
    // a bad pass must not crash the server; Problems/logs capture per-file failures
  }
  g.__ccReconcileTimer = setInterval(() => {
    try {
      reconcile();
    } catch {
      // keep polling
    }
  }, RECONCILE_MS);
  // Don't hold the event loop open on shutdown.
  if (typeof g.__ccReconcileTimer.unref === "function") g.__ccReconcileTimer.unref();
}

export function stopReconciler(): void {
  if (g.__ccReconcileTimer) {
    clearInterval(g.__ccReconcileTimer);
    g.__ccReconcileTimer = undefined;
  }
}
