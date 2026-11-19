import { describe, it, expect, beforeEach } from "vitest";
import { useTempKanban } from "./helpers";
import { parseCard, applyFields, serializeCard, type Card } from "../../src/lib/kanban/card";
import { diff, classify, logCardChange, readEntries, findEntry, appendEntry } from "../../src/lib/kanban/activity";
import { ensureLayout } from "../../src/lib/kanban/store";

// Step 2: activity log + snapshot differ (handoff §4.6, §5.4).

function baseCard(over: Partial<Card> = {}): Card {
  const c = parseCard(
    `---
id: CC-0042
title: Ohio sites presentation
stage: next
boards: [josh]
area: business
project: ohio
due:
order: 2000
created: 2026-11-09T13:20:00-05:00
updated: 2026-11-09T13:20:00-05:00
created_by: josh
source: manual
source_ref:
waiting_on:
waiting_since:
done_at:
discarded_at:
last_actor: josh
last_run:
---

Body.
`,
    "CC-0042.md",
  );
  return { ...c, ...over };
}

describe("diff and classify", () => {
  it("a new card (no snapshot) is a create with only after values", () => {
    const c = baseCard();
    const d = diff(null, c);
    expect(classify(null, c, d)).toBe("create");
    expect(d.before).toEqual({});
    expect(d.after.stage).toBe("next");
  });

  it("a stage change is a move with before/after stage and order", () => {
    const before = baseCard();
    const after = { ...before, stage: "in_progress" as const, order: 3000 };
    const beforeFields = {
      title: before.title,
      stage: before.stage,
      boards: before.boards,
      area: before.area,
      project: before.project,
      due: before.due,
      order: before.order,
      waiting_on: null,
      waiting_since: null,
      done_at: null,
      discarded_at: null,
      notes: before.notes,
    };
    const d = diff(beforeFields, after);
    expect(d.changed.sort()).toEqual(["order", "stage"]);
    expect(classify(beforeFields, after, d)).toBe("move");
    expect(d.before.stage).toBe("next");
    expect(d.after.stage).toBe("in_progress");
  });
});

describe("log append and read", () => {
  beforeEach(() => {
    useTempKanban();
    ensureLayout();
  });

  it("assigns sequential ids within a month and reads them back for a card", () => {
    const c = baseCard();
    const e1 = logCardChange({ beforeFields: null, card: c, actor: "josh", at: "2026-11-09T13:20:00-05:00" });
    const c2 = applyFields(c, { stage: "in_progress", order: 3000 });
    const e2 = logCardChange({
      beforeFields: {
        title: c.title, stage: c.stage, boards: c.boards, area: c.area, project: c.project,
        due: c.due, order: c.order, waiting_on: null, waiting_since: null, done_at: null,
        discarded_at: null, notes: c.notes,
      },
      card: c2,
      actor: "claude",
      run: "sync-2026-11-09-1204",
      at: "2026-11-09T13:25:00-05:00",
    });
    expect(e1!.id).toBe("L-2026-11-000001");
    expect(e2!.id).toBe("L-2026-11-000002");
    expect(e2!.action).toBe("move");
    expect(e2!.actor).toBe("claude");
    expect(e2!.run).toBe("sync-2026-11-09-1204");

    const forCard = readEntries("CC-0042");
    expect(forCard.map((e) => e.id)).toEqual(["L-2026-11-000001", "L-2026-11-000002"]);
    expect(findEntry("L-2026-11-000002")?.after?.stage).toBe("in_progress");
  });

  it("logs nothing when only updated/metadata moved", () => {
    const c = baseCard();
    const beforeFields = {
      title: c.title, stage: c.stage, boards: c.boards, area: c.area, project: c.project,
      due: c.due, order: c.order, waiting_on: null, waiting_since: null, done_at: null,
      discarded_at: null, notes: c.notes,
    };
    const bumped = { ...c, updated: "2026-11-09T14:00:00-05:00", last_actor: "claude" as const };
    expect(logCardChange({ beforeFields, card: bumped, actor: "claude", at: "2026-11-09T14:00:00-05:00" })).toBeNull();
  });
});

describe("revert field application", () => {
  it("applyFields restores the before values from a log entry", () => {
    const original = baseCard();
    const moved = applyFields(original, { stage: "in_progress", order: 3000 });
    const entry = appendEntry({
      at: "2026-11-09T13:25:00-05:00",
      actor: "claude",
      card: "CC-0042",
      action: "move",
      before: { stage: "next", order: 2000 },
      after: { stage: "in_progress", order: 3000 },
      run: "sync-x",
    });
    const reverted = applyFields(moved, entry.before!);
    expect(reverted.stage).toBe("next");
    expect(reverted.order).toBe(2000);
    // And it still serializes to a valid card.
    const back = parseCard(serializeCard(reverted), "CC-0042.md");
    expect(back.stage).toBe("next");
  });
});
