import Link from "next/link";
import type { Deal, Contact } from "@/lib/deals/types";
import { MEMBER } from "@/lib/kanban/view";
import { estimateInfos } from "@/lib/deals/estimates";
import { dealHistoryLines, formatMoney, typeLabel } from "@/lib/deals/view";
import {
  saveDealAction as _save,
  linkEstimateAction,
  unlinkEstimateAction,
  linkDealContactAction,
  unlinkDealContactAction,
  archiveDealAction,
  restoreDealAction,
} from "@/app/(app)/deals/actions";
import DealFieldsForm from "./DealFieldsForm";
import DealBoardCheckbox from "./DealBoardCheckbox";
import DealRevertButton from "./DealRevertButton";

void _save;

const BOARD_LABEL: Record<string, { label: string; accent: string }> = {
  josh: { label: "Josh", accent: "#16181D" },
  christine: { label: "Christine", accent: "#2F5BD3" },
  bishops: { label: "Bishops", accent: "#8A5A00" },
};

// Deal detail panel (handoff §3.3, mockup Deals.dc.html): fields, linked estimates with status and
// total from EZ Binder (stub until CC6), linked contacts, Show on boards, history with Revert on
// every Claude/Duet change (§5.4), and Archive/Restore.
export default function DealPanel({
  deal,
  backHref,
  allContacts,
}: {
  deal: Deal;
  backHref: string;
  allContacts: Contact[];
}) {
  const history = dealHistoryLines(deal.id);
  const estimates = estimateInfos(deal.estimates);
  const linkedIds = new Set(deal.contacts.map((c) => c.id));
  const linkable = allContacts.filter((c) => !linkedIds.has(c.id));

  return (
    <aside className="deal-panel" aria-label="Deal detail">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5B606B" }}>
          Deal · {typeLabel(deal.type)}
          {deal.archivedAt ? " · Archived" : ""}
        </span>
        <Link href={backHref} aria-label="Close" className="subtle">
          Close
        </Link>
      </div>
      <div style={{ fontSize: 18, fontWeight: 600 }} data-testid="deal-panel-name">{deal.name}</div>

      <DealFieldsForm
        id={deal.id}
        type={deal.type}
        stage={deal.stage}
        value={deal.value}
        probability={deal.probability}
        currentTask={deal.currentTask}
        nextAction={deal.nextAction}
        nextActionDate={deal.nextActionDate}
        customerId={deal.customerId}
        jobId={deal.jobId}
        notes={deal.notes}
      />

      <section className="deal-section" aria-label="Linked estimates">
        <div className="deal-section-head">
          <span>Linked estimates · EZ Binder</span>
        </div>
        {estimates.length === 0 ? <span className="subtle">No linked estimates.</span> : null}
        {estimates.map((e) => (
          <div key={e.id} className="deal-estimate" data-testid={`estimate-${e.id}`}>
            <span className="mono" style={{ flex: 1 }}>{e.id}</span>
            <span style={{ fontWeight: 600 }}>{e.status}</span>
            <span className="mono">{formatMoney(e.total)}</span>
            <form action={unlinkEstimateAction}>
              <input type="hidden" name="id" value={deal.id} />
              <input type="hidden" name="estimateId" value={e.id} />
              <button className="btn ghost" type="submit" style={{ height: 26, fontSize: 11 }} aria-label={`Unlink ${e.id}`}>
                Unlink
              </button>
            </form>
          </div>
        ))}
        <form action={linkEstimateAction} className="deal-inline-form">
          <input type="hidden" name="id" value={deal.id} />
          <input type="text" name="estimateId" placeholder="EST-1234" aria-label="Estimate id to link" style={{ height: 30 }} />
          <button className="btn ghost" type="submit" style={{ height: 30, fontSize: 11 }}>+ Link estimate</button>
        </form>
      </section>

      <section className="deal-section" aria-label="Contacts">
        <div className="deal-section-head">
          <span>Contacts</span>
        </div>
        <div className="deal-contact-chips">
          {deal.contacts.length === 0 ? <span className="subtle">No linked contacts.</span> : null}
          {deal.contacts.map((c) => (
            <span key={c.id} className="deal-contact-chip" data-testid={`deal-contact-${c.id}`}>
              <Link href={`/contacts?contact=${c.id}`}>{c.name}</Link>
              <form action={unlinkDealContactAction} style={{ display: "inline" }}>
                <input type="hidden" name="id" value={deal.id} />
                <input type="hidden" name="contactId" value={c.id} />
                <button type="submit" className="chip-x" aria-label={`Unlink ${c.name}`}>×</button>
              </form>
            </span>
          ))}
        </div>
        {linkable.length ? (
          <form action={linkDealContactAction} className="deal-inline-form">
            <input type="hidden" name="id" value={deal.id} />
            <select name="contactId" aria-label="Contact to link" style={{ height: 30 }}>
              {linkable.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""}</option>
              ))}
            </select>
            <button className="btn ghost" type="submit" style={{ height: 30, fontSize: 11 }}>+ Link contact</button>
          </form>
        ) : null}
      </section>

      <fieldset className="deal-boards">
        <legend>Show on boards</legend>
        {(["josh", "christine", "bishops"] as const).map((b) => (
          <DealBoardCheckbox
            key={b}
            dealId={deal.id}
            board={b}
            label={BOARD_LABEL[b].label}
            accent={BOARD_LABEL[b].accent}
            checked={deal.boards.includes(b)}
          />
        ))}
      </fieldset>

      <section aria-label="History" className="deal-hist">
        <div style={{ fontSize: 12, fontWeight: 600 }}>History</div>
        {history.length === 0 ? <span className="subtle">No history yet.</span> : null}
        {history.map((h) => {
          const m = MEMBER[h.actor] ?? MEMBER.unknown;
          return (
            <div key={h.id} className="deal-hist-row" data-testid={`deal-hist-${h.id}`}>
              <span className="kb-badge" style={{ background: m.color, flex: "none" }}>{m.letter}</span>
              <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                <span>{h.text}</span>
                <span className="when mono">{h.when}</span>
              </span>
              {h.revertable ? <DealRevertButton changeId={h.id} /> : null}
            </div>
          );
        })}
      </section>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {deal.archivedAt ? (
          <form action={restoreDealAction}>
            <input type="hidden" name="id" value={deal.id} />
            <button className="btn ghost" type="submit" style={{ height: 34 }}>Restore deal</button>
          </form>
        ) : (
          <form action={archiveDealAction}>
            <input type="hidden" name="id" value={deal.id} />
            <button className="btn ghost" type="submit" style={{ height: 34 }} data-testid={`archive-deal-${deal.id}`}>Archive deal</button>
          </form>
        )}
      </div>
    </aside>
  );
}
