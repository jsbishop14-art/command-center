import { describe, it, expect, beforeEach } from "vitest";
import { useTempDb, useTempKanban } from "./helpers";
import { getDb } from "../../src/lib/db";
import { runMigrations } from "../../src/lib/migrations";
import { ensureLayout } from "../../src/lib/kanban/store";
import { addCard, updateCard, moveCard, appendNote, revertChange, ActionError } from "../../src/lib/kanban/actions-layer";
import { readCardFile } from "../../src/lib/kanban/store";
import { readEntries } from "../../src/lib/kanban/activity";
import { issueToken, revokeToken, resolveToken } from "../../src/lib/kanban/tokens";
import { setDuetEnabled } from "../../src/lib/kanban/state";
import { createPendingNote, confirmNote, dismissNote, listPending, suggestNote } from "../../src/lib/kanban/pending";
import { cardFile } from "../../src/lib/kanban/paths";
import fs from "node:fs";

// Step 4: action layer, tokens, Claude/Duet limits, Duet switch, revert, pending Confirm.
// Covers spec §4 checks 1, 2, 3 and handoff §11 "Kanban storage" check 10 (writers through the app).

const AT = "2026-11-09T13:00:00-05:00";

beforeEach(() => {
  useTempDb();
  useTempKanban();
  runMigrations(getDb());
  ensureLayout();
});

describe("tokens and the Duet switch (handoff §4.8; spec §4 check 3)", () => {
  it("resolves a live token to its writer and denies an unknown one", () => {
    const t = issueToken("claude", AT);
    expect(resolveToken(t)).toEqual({ writer: "claude" });
    expect(resolveToken("nope")).toEqual({ denied: "no_token" });
    expect(resolveToken(null)).toEqual({ denied: "no_token" });
  });

  it("a revoked token is refused", () => {
    const t = issueToken("claude", AT);
    revokeToken("claude", AT);
    expect(resolveToken(t)).toEqual({ denied: "revoked" });
  });

  it("the Duet token is refused when the Duet switch is off, allowed when on", () => {
    const t = issueToken("duet", AT);
    // Default: off.
    expect(resolveToken(t)).toEqual({ denied: "duet_off" });
    setDuetEnabled(true);
    expect(resolveToken(t)).toEqual({ writer: "duet" });
    setDuetEnabled(false);
    expect(resolveToken(t)).toEqual({ denied: "duet_off" });
  });
});

describe("Claude/Duet limits (handoff §4.7 rule 8; spec §4 check 2)", () => {
  function seedCard(stage = "next") {
    return addCard("josh", { title: "Base", stage, boards: ["josh"], area: "business" }, { at: AT });
  }

  it("Claude cannot move a card to done or discarded", () => {
    const c = seedCard();
    expect(() => moveCard("claude", c.id, "done", undefined, { at: AT })).toThrow(ActionError);
    expect(() => moveCard("claude", c.id, "discarded", undefined, { at: AT })).toThrow(/discarded/);
    expect(() => moveCard("duet", c.id, "done", undefined, { at: AT })).toThrow(/done/);
    // But Josh can.
    const done = moveCard("josh", c.id, "done", undefined, { at: AT });
    expect(done.stage).toBe("done");
  });

  it("Claude cannot change boards", () => {
    const c = seedCard();
    expect(() => updateCard("claude", c.id, { boards: ["christine"] }, { at: AT })).toThrow(/boards/);
    const ok = updateCard("josh", c.id, { boards: ["josh", "christine"] }, { at: AT });
    expect(ok.boards).toEqual(["josh", "christine"]);
  });

  it("Claude cannot rewrite a body, but can append", () => {
    const c = seedCard();
    expect(() => updateCard("claude", c.id, { notes: "overwrite" }, { at: AT })).toThrow(/body/);
    const appended = appendNote("claude", c.id, "a claude note", { at: AT });
    expect(appended.notes).toContain("a claude note");
  });

  it("Claude cannot create a card straight into done", () => {
    expect(() => addCard("claude", { title: "x", stage: "done" }, { at: AT })).toThrow(/done/);
  });

  it("Claude can move within allowed stages and it is logged", () => {
    const c = seedCard("inbox");
    const moved = moveCard("claude", c.id, "in_progress", undefined, { at: AT, run: "chat-x" });
    expect(moved.stage).toBe("in_progress");
    const log = readEntries(c.id).find((e) => e.action === "move")!;
    expect(log.actor).toBe("claude");
    expect(log.run).toBe("chat-x");
  });
});

describe("revert (handoff §5.4; spec §4 check 1)", () => {
  it("reverts a Claude change and logs it, naming the undone id", () => {
    const c = addCard("josh", { title: "Base", stage: "next", boards: ["josh"] }, { at: AT });
    const moved = moveCard("claude", c.id, "in_progress", 3000, { at: "2026-11-09T13:05:00-05:00", run: "chat-1" });
    expect(moved.stage).toBe("in_progress");
    const moveEntry = readEntries(c.id).find((e) => e.action === "move")!;
    const result = revertChange("josh", moveEntry.id, { at: "2026-11-09T13:10:00-05:00" });
    expect(result.status).toBe("reverted");
    const after = readCardFile(c.id)!;
    expect(after.stage).toBe("next");
    const revertEntry = readEntries(c.id).find((e) => e.action === "revert")!;
    expect(revertEntry.undoes).toBe(moveEntry.id);
    expect(revertEntry.actor).toBe("josh");
  });

  it("when the card changed again, revert returns both versions and does not overwrite", () => {
    const c = addCard("josh", { title: "Base", stage: "next", boards: ["josh"] }, { at: AT });
    const moveEntry0 = (() => {
      moveCard("claude", c.id, "in_progress", undefined, { at: "2026-11-09T13:05:00-05:00", run: "chat-1" });
      return readEntries(c.id).find((e) => e.action === "move")!;
    })();
    // The card changes again afterwards.
    moveCard("josh", c.id, "waiting_on", undefined, { at: "2026-11-09T13:06:00-05:00" });
    const result = revertChange("josh", moveEntry0.id, { at: "2026-11-09T13:10:00-05:00" });
    expect(result.status).toBe("changed_again");
    if (result.status === "changed_again") {
      expect(result.current.stage).toBe("waiting_on");
      expect(result.after.stage).toBe("in_progress");
    }
    // Card is unchanged until forced.
    expect(readCardFile(c.id)!.stage).toBe("waiting_on");
    const forced = revertChange("josh", moveEntry0.id, { force: true, at: "2026-11-09T13:11:00-05:00" });
    expect(forced.status).toBe("reverted");
    expect(readCardFile(c.id)!.stage).toBe("next");
  });

  it("a Josh change cannot be reverted (only Claude/Duet changes)", () => {
    const c = addCard("josh", { title: "Base", stage: "next", boards: ["josh"] }, { at: AT });
    moveCard("josh", c.id, "in_progress", undefined, { at: "2026-11-09T13:05:00-05:00" });
    const joshMove = readEntries(c.id).find((e) => e.action === "move")!;
    expect(() => revertChange("josh", joshMove.id, { at: AT })).toThrow(/Claude or Duet/);
  });
});

describe("source_ref dedup via the action layer (handoff §4.7 rule 7)", () => {
  it("a second add with the same source_ref is refused", () => {
    addCard("claude", { title: "From email", source: "email", source_ref: "gmail-9" }, { at: AT });
    expect(() => addCard("claude", { title: "Dup", source: "email", source_ref: "gmail-9" }, { at: AT })).toThrow(/already exists/);
  });
});

describe("pending notes Confirm/Change/Dismiss (handoff §4.4)", () => {
  it("confirm creates an inbox card, logs confirm_note, deletes the pending file", () => {
    const note = createPendingNote({ via: "email", text: "Follow up with ES rep", source_ref: "gmail-1", at: AT });
    expect(listPending()).toHaveLength(1);
    const card = confirmNote(note.id, { project: "bnt", boards: ["josh"] }, "josh", "2026-11-09T14:00:00-05:00");
    expect(card.stage).toBe("inbox");
    expect(card.project).toBe("bnt");
    expect(fs.existsSync(cardFile(card.id))).toBe(true);
    expect(listPending()).toHaveLength(0);
    expect(readEntries(card.id).some((e) => e.action === "confirm_note")).toBe(true);
  });

  it("suggest sets the project and boards and logs note_suggested", () => {
    const note = createPendingNote({ via: "email", text: "x", at: AT });
    const after = suggestNote(note.id, { project: "ohio", boards: ["josh", "bishops"] }, "claude", "2026-11-09T14:00:00-05:00", "sync-1");
    expect(after.suggested_project).toBe("ohio");
    expect(after.boards).toEqual(["josh", "bishops"]);
    expect(after.suggested_by).toBe("claude");
  });

  it("dismiss removes the pending file without making a card", () => {
    const note = createPendingNote({ via: "sms", text: "ignore me", at: AT });
    dismissNote(note.id, "josh", "2026-11-09T14:00:00-05:00");
    expect(listPending()).toHaveLength(0);
  });
});
