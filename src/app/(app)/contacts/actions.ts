"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { nowEastern } from "@/lib/kanban/time";
import {
  insertContact,
  updateContactRow,
  setContactEmails,
  linkContactDeal,
  unlinkContactDeal,
} from "@/lib/deals/store";
import { CONTACT_ROLES, type ContactRole } from "@/lib/deals/types";

// Server actions for the Contacts UI (handoff §3.4). Contacts are plain reference data edited only
// through the app by Josh or Christine; they are not part of the action layer (no Revert needed).

function requireUser(): void {
  if (!currentUser()) redirect("/signin");
}

function role(v: FormDataEntryValue | null): ContactRole {
  const r = String(v || "other");
  return (CONTACT_ROLES as readonly string[]).includes(r) ? (r as ContactRole) : "other";
}

// Emails from a textarea: one per line or comma-separated. Stored lowercased by the store layer.
function emailList(v: FormDataEntryValue | null): string[] {
  return String(v || "")
    .split(/[\n,]/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

export type ContactFormState = { ok?: boolean; id?: number; error?: string };

export async function createContactAction(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, error: "Enter a contact name." };
  const id = insertContact(
    {
      name,
      company: String(formData.get("company") || "").trim(),
      role: role(formData.get("role")),
      phone: String(formData.get("phone") || "").trim(),
      notes: String(formData.get("notes") || ""),
      emails: emailList(formData.get("emails")),
    },
    nowEastern(),
  );
  revalidatePath("/contacts");
  return { ok: true, id };
}

export async function saveContactAction(formData: FormData): Promise<void> {
  requireUser();
  const id = Number(formData.get("id"));
  if (!id) return;
  updateContactRow(
    id,
    {
      name: String(formData.get("name") || "").trim() || undefined,
      company: formData.get("company") != null ? String(formData.get("company")) : undefined,
      role: role(formData.get("role")),
      phone: formData.get("phone") != null ? String(formData.get("phone")) : undefined,
      notes: formData.get("notes") != null ? String(formData.get("notes")) : undefined,
    },
    nowEastern(),
  );
  if (formData.get("emails") != null) setContactEmails(id, emailList(formData.get("emails")));
  revalidatePath("/contacts");
}

export async function linkContactDealAction(formData: FormData): Promise<void> {
  requireUser();
  const contactId = Number(formData.get("contactId"));
  const dealId = Number(formData.get("dealId"));
  if (contactId && dealId) linkContactDeal(contactId, dealId);
  revalidatePath("/contacts");
}

export async function unlinkContactDealAction(formData: FormData): Promise<void> {
  requireUser();
  const contactId = Number(formData.get("contactId"));
  const dealId = Number(formData.get("dealId"));
  if (contactId && dealId) unlinkContactDeal(contactId, dealId);
  revalidatePath("/contacts");
}
