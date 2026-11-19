// Shared kanban types (handoff §4.2, §4.4, §4.5, §4.6). Kept free of node/db imports where it can
// be, so both server code and (where needed) client code can use the enums.

export const STAGES = ["inbox", "next", "in_progress", "waiting_on", "done", "discarded"] as const;
export type Stage = (typeof STAGES)[number];

export const AREAS = ["business", "personal", "family"] as const;
export type Area = (typeof AREAS)[number];

export const BOARDS = ["josh", "christine", "bishops"] as const;
export type Board = (typeof BOARDS)[number];

// Writers that can author a change (handoff §4.2 created_by / last_actor; §4.6 actors).
export const ACTORS = ["josh", "christine", "claude", "duet", "unknown"] as const;
export type Actor = (typeof ACTORS)[number];

// Writers that reach the app through the action layer with a token (handoff §4.8).
export const TOKEN_WRITERS = ["claude", "duet"] as const;
export type TokenWriter = (typeof TOKEN_WRITERS)[number];

export const SOURCES = ["manual", "email", "sms", "shortcut", "claude_chat", "sync", "ezbinder"] as const;
export type Source = (typeof SOURCES)[number];

// The documented frontmatter key order for a card file (handoff §4.2). Any key not named here is
// an unknown field and is preserved after these, in file order.
export const CARD_KEY_ORDER = [
  "id",
  "title",
  "stage",
  "boards",
  "area",
  "project",
  "due",
  "order",
  "created",
  "updated",
  "created_by",
  "source",
  "source_ref",
  "waiting_on",
  "waiting_since",
  "done_at",
  "discarded_at",
  "last_actor",
  "last_run",
] as const;

export const PENDING_KEY_ORDER = [
  "id",
  "via",
  "received",
  "source_ref",
  "suggested_project",
  "boards",
  "suggested_at",
  "suggested_by",
] as const;

// A fully-parsed, validated card. Unknown fields are preserved in `extra` for round-tripping.
export type Card = {
  id: string;
  title: string;
  stage: Stage;
  boards: Board[];
  area: Area;
  project: string | null;
  due: string | null;
  order: number;
  created: string;
  updated: string;
  created_by: Actor;
  source: Source;
  source_ref: string | null;
  waiting_on: string | null;
  waiting_since: string | null;
  done_at: string | null;
  discarded_at: string | null;
  last_actor: Actor;
  last_run: string | null;
  notes: string;
  // Unknown frontmatter keys, kept verbatim so a rewrite never drops them.
  extra: Record<string, string | string[] | null>;
  extraOrder: string[];
};
