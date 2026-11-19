import path from "node:path";

// The kanban folder layout (handoff §4.1). A fixed local path on the Mac mini, set in Settings.
// Overridable via CC_KANBAN_DIR so CI and tests each get their own temporary folder. The folder
// must sit outside iCloud/Dropbox/OneDrive on the Mac mini (handoff §4.1); the install guide says
// where. Nothing here touches production (handoff §7.5).

export function kanbanDir(): string {
  return process.env.CC_KANBAN_DIR || path.join(process.cwd(), "kanban");
}

export function boardYamlPath(): string {
  return path.join(kanbanDir(), "board.yaml");
}
export function agentsPath(): string {
  return path.join(kanbanDir(), "AGENTS.md");
}
export function newDir(): string {
  return path.join(kanbanDir(), "new");
}
export function cardsDir(): string {
  return path.join(kanbanDir(), "cards");
}
export function pendingDir(): string {
  return path.join(kanbanDir(), "pending");
}
export function attachmentsDir(): string {
  return path.join(kanbanDir(), "attachments");
}
export function contextDir(): string {
  return path.join(kanbanDir(), "context");
}
export function archiveDir(year: number | string): string {
  return path.join(kanbanDir(), "archive", String(year));
}
export function logDir(): string {
  return path.join(kanbanDir(), "log");
}
export function logFileFor(yyyyMm: string): string {
  return path.join(logDir(), `${yyyyMm}.jsonl`);
}

export function cardFile(id: string): string {
  return path.join(cardsDir(), `${id}.md`);
}
export function pendingFile(id: string): string {
  return path.join(pendingDir(), `${id}.md`);
}
export function contextFile(id: string): string {
  return path.join(contextDir(), `${id}.md`);
}
