import { getDb } from "@/lib/db";
import { nowEastern } from "@/lib/kanban/time";
import type { Board } from "@/lib/kanban/types";
import {
  insertDealRow,
  linkEstimateRow,
  insertContact,
  linkContactDeal,
  type NewDealRow,
  type NewContact,
} from "./store";
import type { DealType } from "./types";

// Seed the five deals (handoff §3.3, spec §1) and a few contacts, so a fresh install shows them
// (spec check 4). Idempotent: if any deal already exists, nothing is seeded. Called from seed()
// after the migrations. These names are Josh's real deal names and already appear in the committed
// spec and mockup; no customer data beyond that is stored. No real outside call, no AI.

type SeedDeal = NewDealRow & { estimates?: string[] };

const DEALS: SeedDeal[] = [
  {
    name: "BNT / ES Windows pool",
    type: "sale" as DealType,
    stage: "Estimating",
    value: 184500,
    probability: 50,
    currentTask: "Firm up the pooled window count with ES",
    nextAction: "Send revised estimate to BNT",
    nextActionDate: "2026-11-24",
    boards: ["josh"] as Board[],
    customerId: "BNT Construction",
    estimates: ["EST-1042", "EST-1043"],
  },
  {
    name: "Ohio affordable housing (two sites)",
    type: "development" as DealType,
    stage: "Entitlement",
    value: 12600000,
    probability: 40,
    currentTask: "Zoning review for both sites",
    nextAction: "Submit entitlement package",
    nextActionDate: "2026-12-05",
    boards: ["josh", "bishops"] as Board[],
    estimates: ["EST-2001"],
  },
  {
    name: "Best Western Naples",
    type: "sale" as DealType,
    stage: "Proposal sent",
    value: 98000,
    probability: 35,
    currentTask: "Await owner feedback on the scope",
    nextAction: "Follow up with the owner",
    nextActionDate: "2026-11-21",
    boards: ["josh"] as Board[],
    estimates: ["EST-2014"],
  },
  {
    name: "33406 (48 units)",
    type: "development" as DealType,
    stage: "Financing",
    value: 8500000,
    probability: 60,
    currentTask: "Line up construction financing",
    nextAction: "Send lender the updated pro forma",
    nextActionDate: "2026-12-01",
    boards: ["josh", "bishops"] as Board[],
    estimates: ["EST-3300"],
  },
  {
    name: "NeighborLee Living",
    type: "development" as DealType,
    stage: "Due diligence",
    value: null,
    probability: 20,
    currentTask: "Review the site survey",
    nextAction: "Walk the site with the partner",
    nextActionDate: null,
    boards: ["josh"] as Board[],
  },
];

// Contacts: lenders, partners and others (handoff §3.4). Each has several emails; a second email is
// used by Awaiting reply matching (spec check 3 — joe@sparkelectric.com is Joe Abrams' second
// address and links to the BNT deal). Linked to deals by name, resolved after the deals are seeded.
const CONTACTS: (NewContact & { dealNames: string[] })[] = [
  {
    name: "Joe Abrams",
    company: "Spark Electric",
    role: "other",
    phone: "(239) 555-0148",
    notes: "Electrical sub Josh pulls in on pool and windows work.",
    emails: ["joe.abrams@outlook.com", "joe@sparkelectric.com"],
    dealNames: ["BNT / ES Windows pool"],
  },
  {
    name: "Marcus Reed",
    company: "Keystone Capital",
    role: "lender",
    phone: "(614) 555-0192",
    notes: "Construction lender for the Ohio and 33406 deals.",
    emails: ["mreed@keystonecap.com", "marcus.reed@keystonecap.com"],
    dealNames: ["Ohio affordable housing (two sites)", "33406 (48 units)"],
  },
  {
    name: "Priya Shah",
    company: "NeighborLee Partners",
    role: "partner",
    phone: "(239) 555-0170",
    notes: "Development partner on NeighborLee Living.",
    emails: ["priya@neighborleepartners.com"],
    dealNames: ["NeighborLee Living"],
  },
];

export function seedDeals(at: string = nowEastern()): { deals: number; contacts: number } {
  const count = (getDb().prepare("SELECT COUNT(*) AS n FROM deals").get() as { n: number }).n;
  if (count > 0) return { deals: 0, contacts: 0 };

  const idByName = new Map<string, number>();
  for (const d of DEALS) {
    const id = insertDealRow(d, "josh", at, null);
    idByName.set(d.name, id);
    for (const e of d.estimates ?? []) linkEstimateRow(id, e, at);
  }
  for (const c of CONTACTS) {
    const id = insertContact(c, at);
    for (const name of c.dealNames) {
      const dealId = idByName.get(name);
      if (dealId) linkContactDeal(id, dealId);
    }
  }
  return { deals: DEALS.length, contacts: CONTACTS.length };
}
