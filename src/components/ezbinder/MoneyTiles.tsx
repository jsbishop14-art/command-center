import type { MoneyTile } from "@/lib/ezbinder/view";

// The four money tiles (handoff §2 item 1, mockup Main.dc.html). Server component; the values come
// from the ezb_money cache the sync and webhook fill, to the cent (spec check 1). When the cache is
// empty (no sync yet, e.g. a fresh Mac mini before EZ Binder is connected) it shows a waiting note.

export default function MoneyTiles({ tiles }: { tiles: MoneyTile[] | null }) {
  if (!tiles) {
    return (
      <section aria-label="Money" className="money-tiles">
        {["Open A/R", "Received this week", "Open invoices", "Over 30 days"].map((label) => (
          <div key={label} className="money-tile">
            <div className="label">{label}</div>
            <div className="value mono" data-testid="money-waiting">
              Waiting on EZ Binder
            </div>
            <div className="src">EZ Binder · not connected</div>
          </div>
        ))}
      </section>
    );
  }
  return (
    <section aria-label="Money" className="money-tiles">
      {tiles.map((t) => (
        <div key={t.label} className="money-tile">
          <div className="label">{t.label}</div>
          <div className="value mono" data-testid={`money-${t.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
            {t.value}
          </div>
          <div className="src">{t.src}</div>
        </div>
      ))}
    </section>
  );
}
