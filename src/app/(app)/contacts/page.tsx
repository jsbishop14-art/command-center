import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listContacts, getContact, searchContacts } from "@/lib/deals/store";
import { listDeals } from "@/lib/deals/actions";
import { ROLE_LABEL, CONTACT_ROLES, type Contact } from "@/lib/deals/types";
import ContactPanel from "@/components/contacts/ContactPanel";
import AddContact from "@/components/contacts/AddContact";

export const dynamic = "force-dynamic";

const ROLE_PILLS = [{ key: "all", label: "All" }, ...CONTACT_ROLES.map((r) => ({ key: r, label: ROLE_LABEL[r] }))];

const ROLE_CHIP: Record<string, { bg: string; ink: string }> = {
  lender: { bg: "#E7EAF1", ink: "#273246" },
  partner: { bg: "#E3EFE7", ink: "#1D4D30" },
  other: { bg: "rgba(22,24,29,0.08)", ink: "#3A3F49" },
};

export default function ContactsPage({
  searchParams,
}: {
  searchParams: { role?: string; contact?: string; q?: string };
}) {
  const user = currentUser();
  if (!user) redirect("/signin");

  const role = CONTACT_ROLES.includes(searchParams.role as never) ? (searchParams.role as string) : "all";
  const query = (searchParams.q || "").trim();

  // Contacts are not board-scoped (they are reference data used by matching); the whole list shows.
  let contacts: Contact[] = query ? searchContacts(query) : listContacts();
  if (role !== "all") contacts = contacts.filter((c) => c.role === role);

  const base = (over: Partial<{ role: string; contact: string; q: string }>) => {
    const p = new URLSearchParams();
    const r = over.role ?? role;
    const q = over.q ?? query;
    if (r && r !== "all") p.set("role", r);
    if (q) p.set("q", q);
    if (over.contact) p.set("contact", over.contact);
    const qs = p.toString();
    return qs ? `/contacts?${qs}` : "/contacts";
  };

  let selected: Contact | null = null;
  if (searchParams.contact) selected = getContact(Number(searchParams.contact));
  const allDeals = selected ? listDeals() : [];

  return (
    <>
      <div className="card kb-top">
        <h1>Contacts</h1>
        <form action="/contacts" method="get" style={{ display: "flex", gap: 6 }}>
          <input type="search" name="q" defaultValue={query} placeholder="Search contacts" aria-label="Search contacts" style={{ height: 36 }} />
          <button className="btn ghost" type="submit" style={{ height: 36 }}>Search</button>
        </form>
        <span style={{ flex: 1 }} />
        <span className="subtle" style={{ fontSize: 12 }}>Lenders, partners and others · EZ Binder customers are looked up live</span>
        <AddContact />
      </div>

      <div className="card kb-filters">
        <span className="label">Role</span>
        {ROLE_PILLS.map((r) => (
          <Link key={r.key} href={base({ role: r.key, contact: undefined })} className={`kb-pill ${role === r.key ? "on" : ""}`}>
            {r.label}
          </Link>
        ))}
      </div>

      <div className="deal-layout">
        <div className="card deal-table" aria-label="Contacts">
          <div className="contact-row deal-head">
            <span>Name</span><span>Company</span><span>Role</span><span>Email</span><span>Phone</span><span>Deals</span>
          </div>
          {contacts.length === 0 ? (
            <p className="subtle" data-testid="contacts-empty" style={{ padding: "10px 4px" }}>No contacts match.</p>
          ) : null}
          {contacts.map((c) => (
            <Link
              key={c.id}
              href={base({ contact: String(c.id) })}
              className={`contact-row deal-item ${selected?.id === c.id ? "selected" : ""}`}
              data-testid="contact-row"
            >
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              <span>{c.company || "—"}</span>
              <span>
                <span className="deal-stage-chip" style={{ background: ROLE_CHIP[c.role].bg, color: ROLE_CHIP[c.role].ink }}>{ROLE_LABEL[c.role]}</span>
              </span>
              <span className="mono" style={{ fontSize: 12 }}>{c.emails[0] || "—"}</span>
              <span className="mono" style={{ fontSize: 12 }}>{c.phone || "—"}</span>
              <span style={{ fontSize: 12 }}>{c.deals.map((d) => d.name).join(", ") || "—"}</span>
            </Link>
          ))}
        </div>

        {selected ? <ContactPanel contact={selected} backHref={base({ contact: undefined })} allDeals={allDeals} /> : null}
      </div>
    </>
  );
}
