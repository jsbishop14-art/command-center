"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";
import { createDealAction, type DealFormState } from "@/app/(app)/deals/actions";

const initial: DealFormState = {};

// "+ Deal" (mockup Deals.dc.html). A small inline form: name + type. On success the new deal opens
// in the panel. New deals default to the board the user is on (handoff §1.3).
export default function AddDeal() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(createDealAction, initial);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && state.id) {
      setOpen(false);
      formRef.current?.reset();
      router.push(`/deals?deal=${state.id}`);
    }
  }, [state, router]);

  if (!open) {
    return (
      <button className="btn" type="button" onClick={() => setOpen(true)} data-testid="add-deal-open">
        + Deal
      </button>
    );
  }
  return (
    <form ref={formRef} action={formAction} className="add-deal-form">
      <input name="name" type="text" placeholder="Deal name" aria-label="Deal name" autoFocus style={{ height: 34 }} data-testid="add-deal-name" />
      <select name="type" aria-label="Deal type" defaultValue="sale" style={{ height: 34 }}>
        <option value="sale">Sale</option>
        <option value="development">Development</option>
      </select>
      <button className="btn" type="submit" data-testid="add-deal-submit">Create</button>
      <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
      {state.error ? <span className="error" role="alert">{state.error}</span> : null}
    </form>
  );
}
