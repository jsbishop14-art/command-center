// EZ Binder data shapes (handoff §2, §2.2, §7.2, §7.3). The S156 contract governs every call; the
// shapes below are modelled on its description in the handoff and are what the stub returns and the
// cache stores. Money is carried in whole cents so the money tiles match EZ Binder "to the cent"
// (spec check 1). No AI anywhere in this module.

// X-EZB-Actor values sent on every call (handoff §7.2). `claude` for Claude-initiated calls;
// `josh` and `rule` for schedule proposals (handoff §2.2); `app` for the dashboard's own reads.
export type EzbActor = "app" | "claude" | "josh" | "rule";

export type GcPhase = "sold_not_started" | "active" | "punch";

// GET /summary/ar — the four money tiles (handoff §2 item 1).
export type ArSummary = {
  openArCents: number;
  receivedThisWeekCents: number;
  openInvoiceCount: number;
  over30Cents: number;
  asOf: string; // EZ Binder's reported timestamp; newest wins (handoff §7.2)
};

// A GC job (handoff §2 Projects). billed/paid in whole cents.
export type EzbJob = {
  jobId: string;
  name: string;
  phase: GcPhase;
  nowTask: string;
  nextTask: string;
  due: string | null;
  billedCents: number;
  paidCents: number;
  boards: string[];
  updatedAt: string;
};

export type TaskKind = "task" | "inspection" | "mobilize";

// A scheduled task on a job (handoff §2 item 4). Dates are Eastern calendar dates (YYYY-MM-DD).
export type EzbTask = {
  taskId: string;
  jobId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  kind: TaskKind;
  completed: boolean;
  updatedAt: string;
};

// GET /schedule — jobs plus their tasks for the active/sold-not-started window.
export type Schedule = { jobs: EzbJob[]; tasks: EzbTask[] };

// An estimate (handoff §3.3 deal cards). total in whole US dollars, matching CC5's deal values.
export type EstimateInfo = { id: string; status: string; total: number | null };

// A customer with an active job (handoff §2 Awaiting reply, 1-day rule).
export type ActiveClient = { email: string; name: string };

// A schedule-move proposal sent to EZ Binder (handoff §2.2). Returns 202 with a reference; it
// changes nothing in EZ Binder until Josh confirms the move there.
export type ProposalRequest = {
  jobId: string;
  taskId: string | null;
  toStart: string;
  toEnd: string;
  actor: EzbActor; // josh | rule | claude — the X-EZB-Actor the proposal is sent under
  note?: string;
};
export type ProposalReceipt = { accepted: boolean; ref: string; status: number };

// One entry from GET /changes (the 90-minute safety-net sync, handoff §7.3). Each has an id so it
// is processed once; entity names which cache to refresh. The newest updated_at wins (handoff §7.2).
export type ChangeEntry = {
  id: string;
  entity: "ar_summary" | "job" | "task";
  updatedAt: string;
};
export type Changes = { entries: ChangeEntry[]; cursor: string };
