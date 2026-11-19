import { describe, it, expect, beforeEach } from "vitest";
import { useTempDb } from "./helpers";
import { getDb } from "../../src/lib/db";
import { runMigrations } from "../../src/lib/migrations";
import { seed } from "../../src/lib/seed";
import {
  createDeal,
  updateDeal,
  readDeal,
  listDeals,
  searchDealList,
  archiveDeal,
  restoreDeal,
  revertDeal,
  dealHistory,
  linkEstimate,
  ActionError,
} from "../../src/lib/deals/actions";
import { contactByEmail, listContacts, searchContacts } from "../../src/lib/deals/store";
import { estimateInfo } from "../../src/lib/deals/estimates";
import { awaitingReply, matchRecipient } from "../../src/lib/feeds/awaiting";

function fresh() {
  useTempDb();
  runMigrations(getDb());
  seed();
}

describe("CC5 deals — seed (spec check 4)", () => {
  beforeEach(fresh);

  it("the five seed deals are present after a fresh install", () => {
    const names = listDeals().map((d) => d.name).sort();
    expect(names).toEqual(
      [
        "33406 (48 units)",
        "Best Western Naples",
        "BNT / ES Windows pool",
        "NeighborLee Living",
        "Ohio affordable housing (two sites)",
      ].sort(),
    );
  });

  it("seeding is idempotent: a second seed adds nothing", () => {
    const before = listDeals().length;
    seed();
    expect(listDeals().length).toBe(before);
  });

  it("linked estimates carry status and total from the EZ Binder stub", () => {
    const bnt = listDeals().find((d) => d.name === "BNT / ES Windows pool")!;
    expect(bnt.estimates).toEqual(["EST-1042", "EST-1043"]);
    expect(estimateInfo("EST-1042").status).toBe("Sent");
    expect(estimateInfo("EST-1042").total).toBe(184500);
    // An id not in the stub still renders without inventing numbers.
    expect(estimateInfo("EST-9999").status).toBe("Unknown");
    expect(estimateInfo("EST-9999").total).toBeNull();
  });
});

describe("CC5 deals — action layer and validation", () => {
  beforeEach(fresh);

  it("create validates type and stage", () => {
    expect(() => createDeal("josh", { name: "X", type: "bogus" })).toThrow(ActionError);
    expect(() => createDeal("josh", { name: "X", type: "sale", stage: "Closing" })).toThrow(ActionError);
    const d = createDeal("josh", { name: "New sale", type: "sale" });
    expect(d.stage).toBe("Lead"); // default first sale stage
  });

  it("update rejects a stage that does not belong to the type", () => {
    const d = listDeals().find((x) => x.type === "sale")!;
    expect(() => updateDeal("josh", d.id, { stage: "Entitlement" })).toThrow(ActionError);
    const ok = updateDeal("josh", d.id, { stage: "Won" });
    expect(ok.stage).toBe("Won");
  });

  it("update rejects an empty board list", () => {
    const d = listDeals()[0];
    expect(() => updateDeal("josh", d.id, { boards: [] })).toThrow(ActionError);
  });

  it("read_deal returns the deal; a missing id throws not_found", () => {
    const d = listDeals()[0];
    expect(readDeal(d.id).name).toBe(d.name);
    expect(() => readDeal(999999)).toThrow(ActionError);
  });
});

describe("CC5 deals — history and Revert (spec check 2)", () => {
  beforeEach(fresh);

  it("a Claude change is logged and Revert restores the earlier values", () => {
    const d = listDeals().find((x) => x.name === "BNT / ES Windows pool")!;
    const before = d.nextAction;
    const changed = updateDeal("claude", d.id, { nextAction: "Call ES about the pool order" }, { run: "chat-1" });
    expect(changed.nextAction).toBe("Call ES about the pool order");

    const hist = dealHistory(d.id);
    const claudeEntry = hist.find((h) => h.actor === "claude")!;
    expect(claudeEntry).toBeTruthy();
    expect(claudeEntry.before?.nextAction).toBe(before);
    expect(claudeEntry.after?.nextAction).toBe("Call ES about the pool order");

    const result = revertDeal("josh", claudeEntry.id);
    expect(result.status).toBe("reverted");
    expect(readDeal(d.id).nextAction).toBe(before);
    // The revert itself is logged, attributed to whoever pressed it, naming the change it undoes.
    const last = dealHistory(d.id).at(-1)!;
    expect(last.action).toBe("revert");
    expect(last.actor).toBe("josh");
    expect(last.undoes).toBe(claudeEntry.id);
  });

  it("a Josh change is not revertable", () => {
    const d = listDeals()[0];
    updateDeal("josh", d.id, { probability: 75 });
    const joshEntry = dealHistory(d.id).find((h) => h.actor === "josh")!;
    expect(() => revertDeal("josh", joshEntry.id)).toThrow(ActionError);
  });

  it("if the deal changed again after the Claude change, Revert asks before overwriting", () => {
    const d = listDeals()[0];
    updateDeal("claude", d.id, { probability: 10 }, { run: "chat-2" });
    const entry = dealHistory(d.id).find((h) => h.actor === "claude")!;
    updateDeal("josh", d.id, { probability: 90 }); // changed again
    const asked = revertDeal("josh", entry.id);
    expect(asked.status).toBe("changed_again");
    // Forcing applies the revert anyway, restoring the Claude change's before value.
    const forced = revertDeal("josh", entry.id, { force: true });
    expect(forced.status).toBe("reverted");
  });
});

describe("CC5 deals — archive (spec §3)", () => {
  beforeEach(fresh);

  it("an archived deal is hidden from the open list but found by search", () => {
    const d = listDeals().find((x) => x.name === "Best Western Naples")!;
    archiveDeal("josh", d.id);
    expect(listDeals().map((x) => x.name)).not.toContain("Best Western Naples");
    expect(listDeals({ includeArchived: true }).map((x) => x.name)).toContain("Best Western Naples");
    expect(searchDealList("naples").map((x) => x.name)).toContain("Best Western Naples");
    restoreDeal("josh", d.id);
    expect(listDeals().map((x) => x.name)).toContain("Best Western Naples");
  });
});

describe("CC5 contacts — email matching (spec check 3)", () => {
  beforeEach(fresh);

  it("a contact's second email matches it and resolves its linked deal", () => {
    // Joe Abrams' addresses are joe.abrams@outlook.com (first) and joe@sparkelectric.com (second).
    const match = contactByEmail("joe@sparkelectric.com");
    expect(match).toBeTruthy();
    expect(match!.contact.name).toBe("Joe Abrams");
    expect(match!.deals.map((x) => x.name)).toContain("BNT / ES Windows pool");
  });

  it("matching is case-insensitive and returns null for an unknown address", () => {
    expect(contactByEmail("JOE@SPARKELECTRIC.COM")?.contact.name).toBe("Joe Abrams");
    expect(contactByEmail("nobody@example.com")).toBeNull();
  });

  it("contacts list and search work", () => {
    expect(listContacts().length).toBe(4);
    expect(searchContacts("keystone").map((c) => c.name)).toEqual(["Marcus Reed"]);
  });

  it("Awaiting reply matches a thread to the right deal by a contact's second email (spec check 3)", () => {
    // joe@sparkelectric.com is Joe Abrams' SECOND address; the stub thread t-spark was sent to it.
    const now = new Date();
    const items = awaitingReply(now);
    const spark = items.find((i) => i.to === "joe@sparkelectric.com")!;
    expect(spark).toBeTruthy();
    expect(spark.matchKind).toBe("deal");
    expect(spark.matchLabel).toBe("BNT / ES Windows pool");
    // An active-job client still labels as a client, not a deal (CC4 behaviour preserved).
    const riverwood = items.find((i) => i.to === "dana@riverwoodbuild.com")!;
    expect(riverwood.matchKind).toBe("client");
    // An address that is neither a client nor a contact stays the bare address.
    expect(matchRecipient("stranger@example.com")).toEqual({ kind: "none", label: "stranger@example.com" });
  });

  it("linking an estimate is reflected on the deal", () => {
    const d = listDeals().find((x) => x.name === "NeighborLee Living")!;
    expect(d.estimates).toEqual([]);
    const after = linkEstimate(d.id, "EST-3300");
    expect(after.estimates).toContain("EST-3300");
  });
});
