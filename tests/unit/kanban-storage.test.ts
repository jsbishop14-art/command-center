import { describe, it, expect, beforeEach } from "vitest";
import { useTempKanban } from "./helpers";
import { parse, serialize } from "../../src/lib/kanban/frontmatter";
import { parseCard, serializeCard, type Card } from "../../src/lib/kanban/card";
import { CARD_KEY_ORDER } from "../../src/lib/kanban/types";
import { defaultConfig, serializeConfig, parseConfig } from "../../src/lib/kanban/boardyaml";

// Step 1: kanban storage core. Frontmatter round-trip, unknown fields survive (handoff §4.7 rule
// 6), card validation (§4.2), board.yaml round-trip (§4.5).

const SAMPLE = `---
id: CC-0042
title: Ohio sites presentation
stage: in_progress
boards: [josh]
area: business
project: ohio-affordable-housing
due: 2026-11-14
order: 3000
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

Notes in plain Markdown.
`;

describe("frontmatter", () => {
  it("parses flat keys, flow lists and empty values", () => {
    const doc = parse(SAMPLE);
    expect(doc.data.id).toBe("CC-0042");
    expect(doc.data.boards).toEqual(["josh"]);
    expect(doc.data.source_ref).toBeNull();
    expect(doc.data.order).toBe("3000");
    expect(doc.body).toBe("Notes in plain Markdown.");
  });

  it("quotes a title that holds a colon and reads it back", () => {
    const text = serialize(
      { data: { title: "Call: ES rep", boards: ["josh", "bishops"] }, order: ["title", "boards"], body: "x" },
      ["title", "boards"],
    );
    expect(text).toContain('title: "Call: ES rep"');
    const back = parse(text);
    expect(back.data.title).toBe("Call: ES rep");
    expect(back.data.boards).toEqual(["josh", "bishops"]);
  });
});

describe("card parse/validate", () => {
  it("parses a valid card", () => {
    const c = parseCard(SAMPLE, "CC-0042.md");
    expect(c.id).toBe("CC-0042");
    expect(c.stage).toBe("in_progress");
    expect(c.order).toBe(3000);
    expect(c.boards).toEqual(["josh"]);
    expect(c.notes).toBe("Notes in plain Markdown.");
  });

  it("round-trips without losing fields", () => {
    const c = parseCard(SAMPLE, "CC-0042.md");
    const again = parseCard(serializeCard(c), "CC-0042.md");
    expect(again).toEqual(c);
  });

  it("keeps unknown fields through a rewrite (handoff §4.7 rule 6)", () => {
    const withExtra = SAMPLE.replace("last_run:\n", "last_run:\ncustom_tag: keep-me\nx_ref: [a, b]\n");
    const c = parseCard(withExtra, "CC-0042.md");
    expect(c.extra.custom_tag).toBe("keep-me");
    expect(c.extra.x_ref).toEqual(["a", "b"]);
    const out = serializeCard(c);
    expect(out).toContain("custom_tag: keep-me");
    expect(out).toContain("x_ref: [a, b]");
    // And the known fields still come first, in documented order.
    const idx = (k: string) => out.indexOf(`\n${k}:`);
    expect(idx("id")).toBeLessThan(idx("custom_tag"));
  });

  it("rejects a bad stage with a plain reason", () => {
    const bad = SAMPLE.replace("stage: in_progress", "stage: nope");
    expect(() => parseCard(bad, "CC-0042.md")).toThrow(/stage/);
  });

  it("rejects a file name that does not match the id", () => {
    expect(() => parseCard(SAMPLE, "CC-9999.md")).toThrow(/does not match/);
  });

  it("requires waiting_on and waiting_since when stage is waiting_on", () => {
    const w = SAMPLE.replace("stage: in_progress", "stage: waiting_on");
    expect(() => parseCard(w, "CC-0042.md")).toThrow(/waiting_on/);
  });

  it("documented key order has all required leading keys", () => {
    expect(CARD_KEY_ORDER[0]).toBe("id");
    expect(CARD_KEY_ORDER).toContain("last_run");
  });
});

describe("board.yaml", () => {
  beforeEach(() => useTempKanban());

  it("round-trips the default config", () => {
    const cfg = defaultConfig();
    const back = parseConfig(serializeConfig(cfg));
    expect(back.schema).toBe(cfg.schema);
    expect(back.stages).toEqual(cfg.stages);
    expect(back.areas).toEqual(cfg.areas);
    expect(back.boards).toEqual(cfg.boards);
  });

  it("round-trips projects", () => {
    const cfg = defaultConfig();
    cfg.projects = [
      { slug: "ohio-affordable-housing", name: "Ohio affordable housing", group: "deal", deal_id: "d1" },
      { slug: "riverwood", name: "Riverwood", group: "gc_job", ezbinder_id: "e9" },
    ];
    const back = parseConfig(serializeConfig(cfg));
    expect(back.projects).toEqual(cfg.projects);
  });
});

// Keep a reference to Card so the type import is exercised.
export type _Card = Card;
