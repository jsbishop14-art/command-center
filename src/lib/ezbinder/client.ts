import { liveFeeds } from "@/lib/feeds/mode";
import { getSecret } from "@/lib/secrets";
import { getAppSetting } from "./store";
import {
  stubArSummary,
  stubActiveClients,
  stubChanges,
  stubEstimate,
  stubProposal,
  stubSchedule,
} from "./stub";
import type {
  ArSummary,
  ActiveClient,
  Changes,
  EstimateInfo,
  ProposalReceipt,
  ProposalRequest,
  Schedule,
} from "./types";

// The EZ Binder client: the single place that "calls EZ Binder" (handoff §7.2: "Claude never holds
// the key. Claude calls the dashboard, and the dashboard calls EZ Binder"). The API key is read
// from the secret store on each call and never returned, logged or passed to Claude. X-EZB-Actor is
// sent on every call (handoff §7.2). No AI in this module.
//
// Mode: the default everywhere — CI, build sessions, local dev — is the stub, so no build session
// or CI job makes a real outside call (CLAUDE §3, spec §6). The live path runs only on the Mac mini
// and only once Josh confirms S156 is live: CC_LIVE_FEEDS=1, the API key set, and app setting
// ezb_live = "1". Until all three hold, every method uses the stub (spec §2). The live request
// shapes follow the S156 contract as described in the handoff and are verified against S156 before
// go-live (EZB-ASK-1 in the status file); they are never exercised by tests.

function liveMode(): boolean {
  return liveFeeds() && getAppSetting("ezb_live") === "1" && !!getSecret("ez_binder_api_key");
}

function baseUrl(): string {
  return getAppSetting("ezb_base_url") || "https://api.ezbinder.example";
}

// Build the headers for a real call: the bearer key from the secret store and the actor.
function headers(actor: string): Record<string, string> {
  const key = getSecret("ez_binder_api_key");
  if (!key) throw new Error("EZ Binder API key is not set");
  return { Authorization: `Bearer ${key}`, "X-EZB-Actor": actor, "Content-Type": "application/json" };
}

async function live<T>(method: string, path: string, actor: string, body?: unknown): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: headers(actor),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok && res.status !== 202) throw new Error(`EZ Binder ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function getArSummary(): Promise<ArSummary> {
  if (!liveMode()) return stubArSummary(nowStamp());
  return live<ArSummary>("GET", "/summary/ar", "app");
}

export async function getSchedule(): Promise<Schedule> {
  if (!liveMode()) return stubSchedule();
  return live<Schedule>("GET", "/schedule", "app");
}

export async function getEstimate(id: string): Promise<EstimateInfo> {
  if (!liveMode()) return stubEstimate(id);
  return live<EstimateInfo>("GET", `/estimates/${encodeURIComponent(id)}`, "app");
}

export async function getActiveClients(): Promise<ActiveClient[]> {
  if (!liveMode()) return stubActiveClients();
  return live<ActiveClient[]>("GET", "/customers?has_active_job=true", "app");
}

export async function getChanges(cursor: string | null): Promise<Changes> {
  if (!liveMode()) return stubChanges(cursor);
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return live<Changes>("GET", `/changes${q}`, "app");
}

// POST a schedule-move proposal (handoff §2.2). Returns 202 with a reference; changes nothing in EZ
// Binder until Josh confirms the move there. The actor becomes X-EZB-Actor (josh, rule or claude).
export async function postProposal(req: ProposalRequest): Promise<ProposalReceipt> {
  if (!liveMode()) return stubProposal(req);
  return live<ProposalReceipt>("POST", "/schedule/proposals", req.actor, {
    job_id: req.jobId,
    task_id: req.taskId,
    to_start: req.toStart,
    to_end: req.toEnd,
    note: req.note ?? "",
  });
}

// The dashboard reads EZ Binder's as_of in stub mode as the current instant (ISO). Kept here so the
// stub does not depend on kanban/time directly in its signature.
function nowStamp(): string {
  return new Date().toISOString();
}

export function ezbIsLive(): boolean {
  return liveMode();
}
