import { BOARDS, type Board, type Actor } from "@/lib/kanban/types";

// Deals and contacts (handoff §3.3, §3.4). Kept free of db imports so client components can use the
// enums and labels. EZ Binder does not hold deals; Command Center stores them (handoff §3.3).

export const DEAL_TYPES = ["sale", "development"] as const;
export type DealType = (typeof DEAL_TYPES)[number];

// Type → its stages, in order (handoff §3.3 table). The stored stage is one of these display
// strings; which set is valid depends on the deal's type.
export const SALE_STAGES = ["Lead", "Estimating", "Proposal sent", "Negotiating", "Won", "Lost"] as const;
export const DEV_STAGES = ["Due diligence", "Entitlement", "Financing", "Closing"] as const;

export function stagesFor(type: DealType): readonly string[] {
  return type === "sale" ? SALE_STAGES : DEV_STAGES;
}

export function isStageFor(type: DealType, stage: string): boolean {
  return stagesFor(type).includes(stage as never);
}

// Stages that end a deal, so it may be archived (handoff §3.3: Won, Lost, or a development deal
// that closes). Used only for a hint; archive is always allowed from the panel.
export const END_STAGES: Record<DealType, readonly string[]> = {
  sale: ["Won", "Lost"],
  development: ["Closing"],
};

export const CONTACT_ROLES = ["lender", "partner", "other"] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export const ROLE_LABEL: Record<ContactRole, string> = {
  lender: "Lender",
  partner: "Partner",
  other: "Other",
};

export const DEAL_TYPE_LABEL: Record<DealType, string> = {
  sale: "Sale",
  development: "Development",
};

export type DealContactRef = { id: number; name: string; role: ContactRole };

export type Deal = {
  id: number;
  name: string;
  type: DealType;
  stage: string;
  value: number | null;
  probability: number | null;
  currentTask: string;
  nextAction: string;
  nextActionDate: string | null;
  notes: string;
  boards: Board[];
  customerId: string | null;
  jobId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  lastActor: Actor | null;
  lastRun: string | null;
  estimates: string[];
  contacts: DealContactRef[];
};

export type ContactDealRef = { id: number; name: string };

export type Contact = {
  id: number;
  name: string;
  company: string;
  role: ContactRole;
  phone: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  emails: string[];
  deals: ContactDealRef[];
};

export function isBoardList(value: unknown): value is Board[] {
  return Array.isArray(value) && value.every((b) => (BOARDS as readonly string[]).includes(b));
}

// The deal fields whose change is meaningful for the history log's before/after (handoff §3.3,
// §5.4). Attribution metadata (updated_at, last_actor, last_run) is not logged content.
export const DEAL_MEANINGFUL = [
  "name",
  "type",
  "stage",
  "value",
  "probability",
  "currentTask",
  "nextAction",
  "nextActionDate",
  "notes",
  "boards",
  "customerId",
  "jobId",
  "archivedAt",
] as const;

export type DealFields = Pick<Deal, (typeof DEAL_MEANINGFUL)[number]>;

export function dealFields(d: Deal): DealFields {
  return {
    name: d.name,
    type: d.type,
    stage: d.stage,
    value: d.value,
    probability: d.probability,
    currentTask: d.currentTask,
    nextAction: d.nextAction,
    nextActionDate: d.nextActionDate,
    notes: d.notes,
    boards: d.boards,
    customerId: d.customerId,
    jobId: d.jobId,
    archivedAt: d.archivedAt,
  };
}
