import crypto from "node:crypto";
import { getSecret } from "@/lib/secrets";
import { saveArSummary, saveJob, saveTask, setLastWebhook } from "./store";
import { runSlipRule, resolveProposal, listProposals } from "./proposals";
import type { ArSummary, EzbJob, EzbTask } from "./types";

// EZ Binder webhook handling (handoff §7.2, §2: changes arrive by webhook within about 10 seconds).
// The receiver route verifies the signature, records the event id once and applies the change with
// newest-updated_at-wins. This module holds the verification and apply logic so it is unit-testable
// without HTTP. No AI.

// Verify the HMAC-SHA256 signature of the raw request body against the stored webhook secret
// (handoff §7.2 "verify webhook signatures"). Returns false on any mismatch, missing signature or
// missing secret, so an unverifiable delivery is refused (spec check 1).
export function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = getSecret("ez_binder_webhook_secret");
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Sign a body with the stored secret — used by tests and by any local tooling to produce a valid
// signature. Never used on an outbound call (the app receives webhooks, it does not send them).
export function signBody(rawBody: string): string {
  const secret = getSecret("ez_binder_webhook_secret") ?? "";
  return crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export type WebhookEvent = {
  id: string;
  type: string;
  updated_at?: string;
  data?: unknown;
};

export type ApplyResult = { outcome: "processed" | "stale"; entity: string | null };

// Apply a verified, first-seen event to the cache. Newest-updated_at-wins is enforced inside the
// store save functions, so a late, out-of-order delivery for an entity never overwrites a newer one
// (handoff §7.2, spec §3). A task change re-runs the slip rule so a slip shows on Home at once.
export async function applyEvent(event: WebhookEvent, at: string): Promise<ApplyResult> {
  switch (event.type) {
    case "ar.summary.updated": {
      const r = saveArSummary(event.data as ArSummary, at);
      return { outcome: r === "saved" ? "processed" : "stale", entity: "ar_summary" };
    }
    case "job.updated": {
      const r = saveJob(event.data as EzbJob, at);
      return { outcome: r === "saved" ? "processed" : "stale", entity: "job" };
    }
    case "task.updated": {
      const r = saveTask(event.data as EzbTask, at);
      if (r === "saved") await runSlipRule({ at });
      return { outcome: r === "saved" ? "processed" : "stale", entity: "task" };
    }
    case "schedule.proposal.resolved": {
      // EZ Binder tells the dashboard a proposal was confirmed or rejected there (handoff §2.2).
      const d = (event.data ?? {}) as { ref?: string; status?: "confirmed" | "rejected" };
      const status = d.status === "rejected" ? "rejected" : "confirmed";
      const match = listProposals().find((p) => p.ezbRef && p.ezbRef === d.ref);
      if (match) resolveProposal(match.id, status, { at });
      return { outcome: "processed", entity: "proposal" };
    }
    default:
      return { outcome: "processed", entity: event.type };
  }
}

export function noteWebhookAt(at: string): void {
  setLastWebhook(at);
}
