import Link from "next/link";
import type { Contact } from "@/lib/deals/types";
import type { Deal } from "@/lib/deals/types";
import { ROLE_LABEL } from "@/lib/deals/types";
import {
  saveContactAction,
  linkContactDealAction,
  unlinkContactDealAction,
} from "@/app/(app)/contacts/actions";

// Contact detail panel (handoff §3.4, mockup Contacts.dc.html): name, company, role, several
// emails, phone, notes, and linked deals. The emails here match this contact's deals in Awaiting
// reply and Inbox suggestions (spec check 3).
export default function ContactPanel({
  contact,
  backHref,
  allDeals,
}: {
  contact: Contact;
  backHref: string;
  allDeals: Deal[];
}) {
  const linkedIds = new Set(contact.deals.map((d) => d.id));
  const linkable = allDeals.filter((d) => !linkedIds.has(d.id));

  return (
    <aside className="deal-panel" aria-label="Contact detail">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5B606B" }}>
          Contact · {ROLE_LABEL[contact.role]}
        </span>
        <Link href={backHref} aria-label="Close" className="subtle">Close</Link>
      </div>
      <div style={{ fontSize: 18, fontWeight: 600 }} data-testid="contact-panel-name">{contact.name}</div>

      <form action={saveContactAction} className="deal-fields">
        <input type="hidden" name="id" value={contact.id} />
        <label className="subtle" htmlFor={`cname-${contact.id}`}>Name</label>
        <input id={`cname-${contact.id}`} name="name" type="text" defaultValue={contact.name} style={{ height: 32 }} />
        <label className="subtle" htmlFor={`ccompany-${contact.id}`}>Company</label>
        <input id={`ccompany-${contact.id}`} name="company" type="text" defaultValue={contact.company} style={{ height: 32 }} />
        <label className="subtle" htmlFor={`crole-${contact.id}`}>Role</label>
        <select id={`crole-${contact.id}`} name="role" defaultValue={contact.role} style={{ height: 32 }}>
          <option value="lender">Lender</option>
          <option value="partner">Partner</option>
          <option value="other">Other</option>
        </select>
        <label className="subtle" htmlFor={`cphone-${contact.id}`}>Phone</label>
        <input id={`cphone-${contact.id}`} name="phone" type="text" defaultValue={contact.phone} style={{ height: 32 }} />
        <label className="subtle" htmlFor={`cemails-${contact.id}`} style={{ gridColumn: "1 / -1" }}>Emails (one per line)</label>
        <textarea
          id={`cemails-${contact.id}`}
          name="emails"
          rows={3}
          defaultValue={contact.emails.join("\n")}
          aria-label="Emails"
          data-testid={`contact-emails-${contact.id}`}
          style={{ gridColumn: "1 / -1", font: "inherit", fontSize: 13, borderRadius: 8, border: "1px solid rgba(22,24,29,0.14)", padding: "8px 10px", resize: "vertical", background: "rgba(255,255,255,0.7)" }}
        />
        <label className="subtle" htmlFor={`cnotes-${contact.id}`} style={{ gridColumn: "1 / -1" }}>Notes</label>
        <textarea
          id={`cnotes-${contact.id}`}
          name="notes"
          rows={3}
          defaultValue={contact.notes}
          style={{ gridColumn: "1 / -1", font: "inherit", fontSize: 13, borderRadius: 8, border: "1px solid rgba(22,24,29,0.14)", padding: "8px 10px", resize: "vertical", background: "rgba(255,255,255,0.7)" }}
        />
        <button className="btn ghost" type="submit" style={{ gridColumn: "1 / -1", height: 32, justifySelf: "start" }} data-testid={`save-contact-${contact.id}`}>
          Save contact
        </button>
      </form>

      <section className="deal-section" aria-label="Linked deals">
        <div className="deal-section-head"><span>Linked deals</span></div>
        <div className="deal-contact-chips">
          {contact.deals.length === 0 ? <span className="subtle">No linked deals.</span> : null}
          {contact.deals.map((d) => (
            <span key={d.id} className="deal-contact-chip" data-testid={`contact-deal-${d.id}`}>
              <Link href={`/deals?deal=${d.id}`}>{d.name}</Link>
              <form action={unlinkContactDealAction} style={{ display: "inline" }}>
                <input type="hidden" name="contactId" value={contact.id} />
                <input type="hidden" name="dealId" value={d.id} />
                <button type="submit" className="chip-x" aria-label={`Unlink ${d.name}`}>×</button>
              </form>
            </span>
          ))}
        </div>
        {linkable.length ? (
          <form action={linkContactDealAction} className="deal-inline-form">
            <input type="hidden" name="contactId" value={contact.id} />
            <select name="dealId" aria-label="Deal to link" style={{ height: 30 }}>
              {linkable.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button className="btn ghost" type="submit" style={{ height: 30, fontSize: 11 }}>+ Link deal</button>
          </form>
        ) : null}
      </section>

      <div className="subtle deal-match-note">
        Emails from these addresses match this contact&rsquo;s deals in Awaiting reply and in Inbox suggestions.
      </div>
    </aside>
  );
}
