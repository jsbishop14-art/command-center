import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getBoard } from "@/lib/prefs";
import { listDeals, readDeal, searchDealList } from "@/lib/deals/actions";
import { listContacts } from "@/lib/deals/store";
import { formatMoney, formatProbability, typeLabel, TYPE_CHIP, dealsOnBoard } from "@/lib/deals/view";
import { DEAL_TYPES, SALE_STAGES, DEV_STAGES, type Deal } from "@/lib/deals/types";
import { BOARD_BADGE } from "@/lib/kanban/view";
import type { Board } from "@/lib/kanban/types";
import DealPanel from "@/components/deals/DealPanel";
import AddDeal from "@/components/deals/AddDeal";

export const dynamic = "force-dynamic";

const TYPE_PILLS = [
  { key: "all", label: "All" },
  { key: "sale", label: "Sale" },
  { key: "development", label: "Development" },
];

export default function DealsPage({
  searchParams,
}: {
  searchParams: { type?: string; show?: string; deal?: string; q?: string };
}) {
  const user = currentUser();
  if (!user) redirect("/signin");

  const board = getBoard(user.id, user.role) as Board;
  const type = DEAL_TYPES.includes(searchParams.type as never) ? (searchParams.type as string) : "all";
  const show = searchParams.show === "archived" ? "archived" : "open";
  const query = (searchParams.q || "").trim();

  // Board toggle filters deals by their boards list (spec check 5, handoff §1.3).
  let deals: Deal[];
  if (query) {
    deals = dealsOnBoard(searchDealList(query), board);
  } else {
    deals = dealsOnBoard(listDeals({ includeArchived: true }), board).filter((d) =>
      show === "archived" ? d.archivedAt : !d.archivedAt,
    );
  }
  if (type !== "all") deals = deals.filter((d) => d.type === type);

  const base = (over: Partial<{ type: string; show: string; deal: string; q: string }>) => {
    const p = new URLSearchParams();
    const t = over.type ?? type;
    const s = over.show ?? show;
    const q = over.q ?? query;
    if (t && t !== "all") p.set("type", t);
    if (s && s !== "open") p.set("show", s);
    if (q) p.set("q", q);
    if (over.deal) p.set("deal", over.deal);
    const qs = p.toString();
    return qs ? `/deals?${qs}` : "/deals";
  };

  let selected: Deal | null = null;
  if (searchParams.deal) {
    try {
      selected = readDeal(Number(searchParams.deal));
    } catch {
      selected = null;
    }
  }
  const allContacts = selected ? listContacts() : [];

  return (
    <>
      <div className="card kb-top">
        <h1>Deals</h1>
        <form action="/deals" method="get" style={{ display: "flex", gap: 6 }}>
          <input type="search" name="q" defaultValue={query} placeholder="Search deals" aria-label="Search deals" style={{ height: 36 }} />
          <button className="btn ghost" type="submit" style={{ height: 36 }}>Search</button>
        </form>
        <span style={{ flex: 1 }} />
        <AddDeal />
      </div>

      <div className="card kb-filters">
        <span className="label">Type</span>
        {TYPE_PILLS.map((t) => (
          <Link key={t.key} href={base({ type: t.key, deal: undefined })} className={`kb-pill ${type === t.key ? "on" : ""}`}>
            {t.label}
          </Link>
        ))}
        <span className="label" style={{ marginLeft: 12 }}>Show</span>
        <Link href={base({ show: "open", deal: undefined })} className={`kb-pill ${show === "open" ? "on" : ""}`}>Open deals</Link>
        <Link href={base({ show: "archived", deal: undefined })} className={`kb-pill ${show === "archived" ? "on" : ""}`}>Archived</Link>
      </div>

      <div className="deal-layout">
        <div className="card deal-table" aria-label="Deals">
          <div className="deal-row deal-head">
            <span>Deal</span><span>Stage</span><span>Value</span><span>Prob.</span><span>Next action</span><span>Date</span><span>Boards</span>
          </div>
          {deals.length === 0 ? (
            <p className="subtle" data-testid="deals-empty" style={{ padding: "10px 4px" }}>
              {query ? "No deals match." : show === "archived" ? "No archived deals on this board." : "No open deals on this board."}
            </p>
          ) : null}
          {deals.map((d) => (
            <Link
              key={d.id}
              href={base({ deal: String(d.id) })}
              className={`deal-row deal-item ${selected?.id === d.id ? "selected" : ""}`}
              data-testid="deal-row"
            >
              <span className="deal-name">
                <span style={{ fontWeight: 600 }}>{d.name}</span>
                <span className="subtle" style={{ fontSize: 11 }}>{typeLabel(d.type)}{d.archivedAt ? " · archived" : ""}</span>
              </span>
              <span>
                <span className="deal-stage-chip" style={{ background: TYPE_CHIP[d.type].bg, color: TYPE_CHIP[d.type].ink }}>{d.stage}</span>
              </span>
              <span className="mono">{formatMoney(d.value)}</span>
              <span className="mono">{formatProbability(d.probability)}</span>
              <span style={{ fontSize: 13 }}>{d.nextAction || "—"}</span>
              <span className="mono subtle" style={{ fontSize: 12 }}>{d.nextActionDate || "—"}</span>
              <span style={{ display: "flex", gap: 3 }}>
                {d.boards.map((b) => (
                  <span key={b} className="kb-badge" style={{ background: BOARD_BADGE[b].color }}>{BOARD_BADGE[b].letter}</span>
                ))}
              </span>
            </Link>
          ))}
          <div className="deal-stage-legend subtle">
            <span><strong>Sale stages:</strong> {SALE_STAGES.join(", ")}</span>
            <span><strong>Development stages:</strong> {DEV_STAGES.join(", ")}</span>
          </div>
        </div>

        {selected ? <DealPanel deal={selected} backHref={base({ deal: undefined })} allContacts={allContacts} /> : null}
      </div>
    </>
  );
}
