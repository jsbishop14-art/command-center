import { getDb } from "@/lib/db";
import type { Board, Actor } from "@/lib/kanban/types";
import {
  type Deal,
  type Contact,
  type ContactRole,
  type DealType,
  type DealContactRef,
  type ContactDealRef,
  isBoardList,
} from "./types";

// Database access for deals and contacts (handoff §3.3, §3.4). Pure storage: no history logging and
// no limit checks. The action layer (actions.ts) wraps these with logging and Revert so Claude and
// Duet never touch the database directly (spec §3). Single household: no tenant id, no row security.

type DealRow = {
  id: number;
  name: string;
  type: string;
  stage: string;
  value: number | null;
  probability: number | null;
  current_task: string;
  next_action: string;
  next_action_date: string | null;
  notes: string;
  boards: string;
  customer_id: string | null;
  job_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  last_actor: string | null;
  last_run: string | null;
  deleted_at: string | null;
};

function parseBoards(json: string): Board[] {
  try {
    const v = JSON.parse(json);
    if (isBoardList(v) && v.length) return v;
  } catch {
    // fall through
  }
  return ["josh"];
}

function estimatesFor(dealId: number): string[] {
  return (
    getDb()
      .prepare("SELECT estimate_id FROM deal_estimates WHERE deal_id = ? ORDER BY linked_at, estimate_id")
      .all(dealId) as { estimate_id: string }[]
  ).map((r) => r.estimate_id);
}

function contactsFor(dealId: number): DealContactRef[] {
  return getDb()
    .prepare(
      `SELECT c.id AS id, c.name AS name, c.role AS role
         FROM contact_deals cd JOIN contacts c ON c.id = cd.contact_id
        WHERE cd.deal_id = ? AND c.deleted_at IS NULL
        ORDER BY c.name`,
    )
    .all(dealId) as DealContactRef[];
}

function rowToDeal(r: DealRow): Deal {
  return {
    id: r.id,
    name: r.name,
    type: r.type as DealType,
    stage: r.stage,
    value: r.value,
    probability: r.probability,
    currentTask: r.current_task,
    nextAction: r.next_action,
    nextActionDate: r.next_action_date,
    notes: r.notes,
    boards: parseBoards(r.boards),
    customerId: r.customer_id,
    jobId: r.job_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    archivedAt: r.archived_at,
    lastActor: (r.last_actor as Actor) ?? null,
    lastRun: r.last_run,
    estimates: estimatesFor(r.id),
    contacts: contactsFor(r.id),
  };
}

export function getDealRow(id: number): Deal | null {
  const r = getDb()
    .prepare("SELECT * FROM deals WHERE id = ? AND deleted_at IS NULL")
    .get(id) as DealRow | undefined;
  return r ? rowToDeal(r) : null;
}

// All deals (not soft-deleted). includeArchived controls whether archived deals are included. The
// Projects grid and the open-deals view hide archived deals; search includes them (spec §3).
export function listDealRows(opts?: { includeArchived?: boolean }): Deal[] {
  const where = opts?.includeArchived ? "deleted_at IS NULL" : "deleted_at IS NULL AND archived_at IS NULL";
  const rows = getDb()
    .prepare(`SELECT * FROM deals WHERE ${where} ORDER BY archived_at IS NOT NULL, id`)
    .all() as DealRow[];
  return rows.map(rowToDeal);
}

export function searchDeals(query: string): Deal[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return listDealRows({ includeArchived: true }).filter(
    (d) =>
      d.name.toLowerCase().includes(q) ||
      d.notes.toLowerCase().includes(q) ||
      d.stage.toLowerCase().includes(q) ||
      (d.customerId ?? "").toLowerCase().includes(q),
  );
}

export type NewDealRow = {
  name: string;
  type: DealType;
  stage: string;
  value?: number | null;
  probability?: number | null;
  currentTask?: string;
  nextAction?: string;
  nextActionDate?: string | null;
  notes?: string;
  boards?: Board[];
  customerId?: string | null;
  jobId?: string | null;
};

export function insertDealRow(input: NewDealRow, actor: Actor, at: string, run: string | null): number {
  const info = getDb()
    .prepare(
      `INSERT INTO deals
         (name, type, stage, value, probability, current_task, next_action, next_action_date,
          notes, boards, customer_id, job_id, created_at, updated_at, last_actor, last_run)
       VALUES (@name, @type, @stage, @value, @probability, @current_task, @next_action,
          @next_action_date, @notes, @boards, @customer_id, @job_id, @at, @at, @actor, @run)`,
    )
    .run({
      name: input.name,
      type: input.type,
      stage: input.stage,
      value: input.value ?? null,
      probability: input.probability ?? null,
      current_task: input.currentTask ?? "",
      next_action: input.nextAction ?? "",
      next_action_date: input.nextActionDate ?? null,
      notes: input.notes ?? "",
      boards: JSON.stringify(input.boards && input.boards.length ? input.boards : ["josh"]),
      customer_id: input.customerId ?? null,
      job_id: input.jobId ?? null,
      at,
      actor,
      run,
    });
  return Number(info.lastInsertRowid);
}

// Apply column changes from a parsed Deal's fields. Only the columns present in `patch` are written.
// Boards are stored as JSON. Attribution (updated_at/last_actor/last_run) is always set.
export function writeDealRow(
  id: number,
  patch: Partial<Deal>,
  actor: Actor,
  at: string,
  run: string | null,
): void {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id, at, actor, run };
  const col: Record<string, string> = {
    name: "name",
    type: "type",
    stage: "stage",
    value: "value",
    probability: "probability",
    currentTask: "current_task",
    nextAction: "next_action",
    nextActionDate: "next_action_date",
    notes: "notes",
    customerId: "customer_id",
    jobId: "job_id",
    archivedAt: "archived_at",
  };
  for (const [k, c] of Object.entries(col)) {
    if (k in patch) {
      sets.push(`${c} = @${c}`);
      params[c] = (patch as Record<string, unknown>)[k] ?? null;
    }
  }
  if ("boards" in patch) {
    sets.push("boards = @boards");
    params.boards = JSON.stringify(patch.boards && patch.boards.length ? patch.boards : ["josh"]);
  }
  sets.push("updated_at = @at", "last_actor = @actor", "last_run = @run");
  getDb()
    .prepare(`UPDATE deals SET ${sets.join(", ")} WHERE id = @id`)
    .run(params);
}

// ---- Estimate links (handoff §3.3) ------------------------------------------------------------

export function linkEstimateRow(dealId: number, estimateId: string, at: string): void {
  getDb()
    .prepare(
      "INSERT OR IGNORE INTO deal_estimates (deal_id, estimate_id, linked_at) VALUES (?, ?, ?)",
    )
    .run(dealId, estimateId, at);
}

export function unlinkEstimateRow(dealId: number, estimateId: string): void {
  getDb().prepare("DELETE FROM deal_estimates WHERE deal_id = ? AND estimate_id = ?").run(dealId, estimateId);
}

// ---- Contacts (handoff §3.4) ------------------------------------------------------------------

type ContactRow = {
  id: number;
  name: string;
  company: string;
  role: string;
  phone: string;
  notes: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function emailsFor(contactId: number): string[] {
  return (
    getDb()
      .prepare("SELECT email FROM contact_emails WHERE contact_id = ? ORDER BY sort, email")
      .all(contactId) as { email: string }[]
  ).map((r) => r.email);
}

function dealsForContact(contactId: number): ContactDealRef[] {
  return getDb()
    .prepare(
      `SELECT d.id AS id, d.name AS name
         FROM contact_deals cd JOIN deals d ON d.id = cd.deal_id
        WHERE cd.contact_id = ? AND d.deleted_at IS NULL
        ORDER BY d.name`,
    )
    .all(contactId) as ContactDealRef[];
}

function rowToContact(r: ContactRow): Contact {
  return {
    id: r.id,
    name: r.name,
    company: r.company,
    role: r.role as ContactRole,
    phone: r.phone,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    emails: emailsFor(r.id),
    deals: dealsForContact(r.id),
  };
}

export function getContact(id: number): Contact | null {
  const r = getDb()
    .prepare("SELECT * FROM contacts WHERE id = ? AND deleted_at IS NULL")
    .get(id) as ContactRow | undefined;
  return r ? rowToContact(r) : null;
}

export function listContacts(): Contact[] {
  const rows = getDb()
    .prepare("SELECT * FROM contacts WHERE deleted_at IS NULL ORDER BY name")
    .all() as ContactRow[];
  return rows.map(rowToContact);
}

export type NewContact = {
  name: string;
  company?: string;
  role: ContactRole;
  phone?: string;
  notes?: string;
  emails?: string[];
};

export function insertContact(input: NewContact, at: string): number {
  const info = getDb()
    .prepare(
      `INSERT INTO contacts (name, company, role, phone, notes, created_at, updated_at)
       VALUES (@name, @company, @role, @phone, @notes, @at, @at)`,
    )
    .run({
      name: input.name,
      company: input.company ?? "",
      role: input.role,
      phone: input.phone ?? "",
      notes: input.notes ?? "",
      at,
    });
  const id = Number(info.lastInsertRowid);
  if (input.emails) setContactEmails(id, input.emails);
  return id;
}

export function updateContactRow(
  id: number,
  patch: { name?: string; company?: string; role?: ContactRole; phone?: string; notes?: string },
  at: string,
): void {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id, at };
  for (const k of ["name", "company", "role", "phone", "notes"] as const) {
    if (patch[k] !== undefined) {
      sets.push(`${k} = @${k}`);
      params[k] = patch[k];
    }
  }
  sets.push("updated_at = @at");
  getDb().prepare(`UPDATE contacts SET ${sets.join(", ")} WHERE id = @id`).run(params);
}

// Replace a contact's email set. Addresses are stored lowercased so recipient matching is
// case-insensitive (handoff §3.4; spec check 3). Blank entries are dropped.
export function setContactEmails(contactId: number, emails: string[]): void {
  const clean = emails
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
    .filter((e, i, a) => a.indexOf(e) === i);
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM contact_emails WHERE contact_id = ?").run(contactId);
    const ins = db.prepare("INSERT INTO contact_emails (contact_id, email, sort) VALUES (?, ?, ?)");
    clean.forEach((e, i) => ins.run(contactId, e, i));
  });
  tx();
}

export function linkContactDeal(contactId: number, dealId: number): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO contact_deals (contact_id, deal_id) VALUES (?, ?)")
    .run(contactId, dealId);
}

export function unlinkContactDeal(contactId: number, dealId: number): void {
  getDb().prepare("DELETE FROM contact_deals WHERE contact_id = ? AND deal_id = ?").run(contactId, dealId);
}

export function searchContacts(query: string): Contact[] {
  const q = query.trim().toLowerCase();
  if (!q) return listContacts();
  return listContacts().filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.emails.some((e) => e.includes(q)),
  );
}

// Match a recipient email to a contact and its linked deals (handoff §3.4: "Emails from these
// addresses match this contact's deals in Awaiting reply"). Case-insensitive, by any of a contact's
// addresses (spec check 3). Returns the matched contact and its deals, or null.
export function contactByEmail(email: string): { contact: Contact; deals: ContactDealRef[] } | null {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  const row = getDb()
    .prepare(
      `SELECT c.id AS id FROM contact_emails ce JOIN contacts c ON c.id = ce.contact_id
        WHERE ce.email = ? AND c.deleted_at IS NULL LIMIT 1`,
    )
    .get(e) as { id: number } | undefined;
  if (!row) return null;
  const contact = getContact(row.id);
  if (!contact) return null;
  return { contact, deals: contact.deals };
}
