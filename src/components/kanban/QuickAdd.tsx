"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFormState, useFormStatus } from "react-dom";
import { quickAddAction, type ActionResult } from "@/app/(app)/kanban/actions";
import { lookupAction } from "@/app/(app)/phone/actions";
import { looksLikePhone } from "@/lib/phone/normalize";

const initial: ActionResult = { ok: false };

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn accent" type="submit" disabled={pending}>
      {pending ? "Adding…" : "Add card"}
    </button>
  );
}

// Quick add (Ctrl K) creates a card on the board you are on (spec §1). The "+ Card" button opens
// the same dialog.
export default function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState("");
  const [state, formAction] = useFormState(quickAddAction, initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);

  // Quick add recognizes a pasted phone number and offers to look it up (handoff §8.2, spec §1).
  const phoneCandidate = looksLikePhone(title);

  // Only render the portal after mount (document.body exists on the client).
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close once a card is successfully added.
  useEffect(() => {
    if (wasOpen.current && state.ok) setOpen(false);
    wasOpen.current = open;
  }, [state, open]);

  return (
    <>
      <button className="btn accent" type="button" onClick={() => setOpen(true)} data-testid="add-card">
        + Card
      </button>
      {open && mounted
        ? createPortal(
            // Rendered into document.body: an ancestor .card uses backdrop-filter, which would
            // otherwise make this fixed overlay a containing block trapped behind the board columns.
            <div
              className="qa-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Quick add card"
              onClick={() => setOpen(false)}
            >
              <div className="qa-dialog" onClick={(e) => e.stopPropagation()}>
                <h2>Quick add</h2>
                <p className="subtle">Adds a card to the board you are on, in Inbox.</p>
                <form action={formAction} className="qa-form">
                  <label className="field">
                    Title
                    <input
                      ref={inputRef}
                      type="text"
                      name="title"
                      aria-label="Card title"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Area
                    <select name="area" defaultValue="business" aria-label="Area">
                      <option value="business">Business</option>
                      <option value="personal">Personal</option>
                      <option value="family">Family</option>
                    </select>
                  </label>
                  {state.error ? (
                    <span className="error" role="alert">
                      {state.error}
                    </span>
                  ) : null}
                  <div className="qa-actions">
                    <button className="btn ghost" type="button" onClick={() => setOpen(false)}>
                      Cancel
                    </button>
                    <AddButton />
                  </div>
                </form>
                {phoneCandidate ? (
                  <form action={lookupAction} className="qa-phone-offer" data-testid="qa-lookup-offer">
                    <span className="subtle">Looks like a phone number.</span>
                    <input type="hidden" name="phone" value={title} />
                    <button className="btn ghost" type="submit" data-testid="qa-lookup">
                      Look up number
                    </button>
                  </form>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
