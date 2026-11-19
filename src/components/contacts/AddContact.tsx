"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";
import { createContactAction, type ContactFormState } from "@/app/(app)/contacts/actions";

const initial: ContactFormState = {};

// "+ Contact" (mockup Contacts.dc.html). Name, company, role and emails; on success the new contact
// opens in the panel.
export default function AddContact() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(createContactAction, initial);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && state.id) {
      setOpen(false);
      formRef.current?.reset();
      router.push(`/contacts?contact=${state.id}`);
    }
  }, [state, router]);

  if (!open) {
    return (
      <button className="btn" type="button" onClick={() => setOpen(true)} data-testid="add-contact-open">
        + Contact
      </button>
    );
  }
  return (
    <form ref={formRef} action={formAction} className="add-contact-form">
      <input name="name" type="text" placeholder="Name" aria-label="Contact name" autoFocus style={{ height: 34 }} data-testid="add-contact-name" />
      <input name="company" type="text" placeholder="Company" aria-label="Company" style={{ height: 34 }} />
      <select name="role" aria-label="Role" defaultValue="lender" style={{ height: 34 }}>
        <option value="lender">Lender</option>
        <option value="partner">Partner</option>
        <option value="other">Other</option>
      </select>
      <input name="emails" type="text" placeholder="emails, comma-separated" aria-label="Emails" style={{ height: 34, minWidth: 220 }} />
      <button className="btn" type="submit" data-testid="add-contact-submit">Create</button>
      <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
      {state.error ? <span className="error" role="alert">{state.error}</span> : null}
    </form>
  );
}
