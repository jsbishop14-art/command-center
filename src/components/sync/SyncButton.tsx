"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  syncInfoAction,
  runSyncAction,
  revertSyncAction,
  revertAllSyncAction,
  type SyncInfo,
} from "@/app/(app)/sync/actions";
import type { SyncRun, SyncItemKey } from "@/lib/sync/store";
import UsageChart from "./UsageChart";

// Sync with Claude (handoff §5.1). Opens a popup with the three items (all checked), the usage
// tiles and the 30-day chart; after Run sync a results list shows every change with Revert
// (Withdraw for schedule proposals) and Revert all. Claude runs only on Run sync — no timer (§8).

type ItemMeta = { key: SyncItemKey; name: string; detail: string; unit: string };
const ITEMS: ItemMeta[] = [
  { key: "inbox", name: "Sort Inbox notes", detail: "Suggest a project and boards for each new note. Nothing files until you confirm", unit: "new" },
  { key: "kanban", name: "Kanban updates", detail: "Add or move cards from notes, emails and EZ Binder changes. Applied directly, each with Revert", unit: "changes" },
  { key: "schedule", name: "Schedule proposals", detail: "Propose schedule moves from EZ Binder data. Nothing changes until you confirm in EZ Binder", unit: "jobs" },
];

function tokens(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("en-US");
}

export default function SyncButton() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [info, setInfo] = useState<SyncInfo | null>(null);
  const [checked, setChecked] = useState<Record<SyncItemKey, boolean>>({ inbox: true, kanban: true, schedule: true });
  const [run, setRun] = useState<SyncRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changedAgain, setChangedAgain] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();

  useEffect(() => setMounted(true), []);

  function openDialog() {
    setOpen(true);
    setRun(null);
    setError(null);
    setChangedAgain(new Set());
    start(async () => {
      const r = await syncInfoAction();
      if ("error" in r) setError(r.error);
      else setInfo(r);
    });
  }

  function close() {
    setOpen(false);
  }

  function count(key: SyncItemKey): number {
    return info ? info.preview[key] : 0;
  }

  function doRun() {
    const items = ITEMS.filter((i) => checked[i.key]).map((i) => i.key);
    if (items.length === 0) {
      setError("Pick at least one item to run.");
      return;
    }
    setError(null);
    start(async () => {
      const r = await runSyncAction(items);
      if ("error" in r) setError(r.error);
      else setRun(r.run);
    });
  }

  function doRevert(seq: number) {
    const force = changedAgain.has(seq);
    start(async () => {
      const r = await revertSyncAction(run!.id, seq, force);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      if (r.outcome.status === "changed_again") {
        setChangedAgain((s) => new Set(s).add(seq));
      } else if (r.run) {
        setRun(r.run);
      }
    });
  }

  function doRevertAll() {
    start(async () => {
      const r = await revertAllSyncAction(run!.id);
      if ("error" in r) setError(r.error);
      else if (r.run) setRun(r.run);
    });
  }

  const dialog = (
    <div className="qa-overlay" role="dialog" aria-modal="true" aria-label="Sync with Claude" onClick={close}>
      <div className="sync-dialog" data-testid="sync-dialog" onClick={(e) => e.stopPropagation()}>
        {run ? renderResults() : renderConfig()}
      </div>
    </div>
  );

  function renderConfig() {
    return (
      <>
        <div className="sync-head">
          <h2>Sync with Claude</h2>
          <button className="btn ghost" type="button" aria-label="Close" onClick={close}>✕</button>
        </div>
        <p className="subtle">Pick what Claude runs now. Everything is checked by default.</p>

        <fieldset className="sync-items">
          <legend className="sr-only">Sync items</legend>
          {ITEMS.map((it) => (
            <label key={it.key} className="sync-item">
              <input
                type="checkbox"
                checked={checked[it.key]}
                data-testid={`sync-item-${it.key}`}
                onChange={(e) => setChecked((c) => ({ ...c, [it.key]: e.target.checked }))}
              />
              <span className="sync-item-text">
                <span className="sync-item-name">{it.name}</span>
                <span className="subtle">{it.detail}</span>
              </span>
              <span className="mono sync-item-count" data-testid={`sync-count-${it.key}`}>
                {count(it.key)} {it.unit}
              </span>
            </label>
          ))}
        </fieldset>

        <p className="sync-note subtle">
          Claude runs only when you press Run sync. No scheduled runs. An item with nothing new since the last Sync is
          skipped without using tokens. Every change can be reverted on the results list
          {info?.lastRunAt ? ` · last run ${info.lastRunAt.slice(0, 16).replace("T", " ")}` : ""}.
        </p>

        <div className="sync-tiles">
          <div className="sync-tile">
            <span className="subtle">Last sync used</span>
            <span className="mono" data-testid="sync-tile-last">{tokens(info?.usage.lastRunTokens ?? null)}</span>
          </div>
          <div className="sync-tile">
            <span className="subtle">Dashboard this week</span>
            <span className="mono" data-testid="sync-tile-week">{tokens(info?.usage.weekTokens ?? 0)}</span>
          </div>
          <div className="sync-tile">
            <span className="subtle">Weekly plan used</span>
            <span className="mono" data-testid="sync-tile-plan">{info?.usage.planPct === null || info?.usage.planPct === undefined ? "—" : `${info.usage.planPct}%`}</span>
          </div>
        </div>

        <UsageChart days={info?.usage30 ?? []} />

        {error ? <span className="error" role="alert">{error}</span> : null}

        <div className="sync-actions">
          <button className="btn ghost" type="button" onClick={close}>Cancel</button>
          <button className="btn accent" type="button" data-testid="sync-run" disabled={pending || !info} onClick={doRun}>
            {pending ? "Running…" : "Run sync"}
          </button>
        </div>
      </>
    );
  }

  function renderResults() {
    const r = run!;
    const skippedNames = r.skipped.map((k) => ITEMS.find((i) => i.key === k)?.name ?? k);
    return (
      <div data-testid="sync-results">
        <div className="sync-head">
          <h2>Sync finished</h2>
          <button className="btn ghost" type="button" aria-label="Close" onClick={close}>✕</button>
        </div>
        <div className="mono subtle">{r.id} · {r.changes.length} changes · {tokens(r.totalTokens)} tokens</div>

        <div className="sync-change-list">
          {r.changes.length === 0 ? <div className="subtle">No changes this run.</div> : null}
          {r.changes.map((c) => (
            <div key={c.seq} className="sync-change" data-testid={`sync-change-${c.seq}`}>
              <span className={`sync-tag sync-tag-${c.kind}`}>{c.kind}</span>
              <span className="sync-change-text">
                <span>{c.label}</span>
                <span className="subtle">{c.sub}</span>
              </span>
              {c.revertedAt ? (
                <span className="subtle" data-testid={`sync-reverted-${c.seq}`}>Reverted</span>
              ) : (
                <button
                  className="btn ghost sync-revert"
                  type="button"
                  data-testid={`sync-revert-${c.seq}`}
                  disabled={pending}
                  onClick={() => doRevert(c.seq)}
                >
                  {changedAgain.has(c.seq) ? `${c.action} anyway` : c.action}
                </button>
              )}
            </div>
          ))}
        </div>

        {skippedNames.length ? (
          <div className="subtle" data-testid="sync-skipped">Skipped, nothing new: {skippedNames.join(", ")}</div>
        ) : null}

        {error ? <span className="error" role="alert">{error}</span> : null}

        <div className="sync-actions spread">
          <button className="btn danger" type="button" data-testid="sync-revert-all" disabled={pending} onClick={doRevertAll}>
            Revert all from this run
          </button>
          <button className="btn dark" type="button" data-testid="sync-done" onClick={close}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button className="chip" type="button" data-testid="sync-open" onClick={openDialog}>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.15 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Sync with Claude</span>
          <span className="mono" style={{ fontSize: 10, color: "#b8bcc6" }}>runs on press · no timer</span>
        </span>
      </button>
      {open && mounted ? createPortal(dialog, document.body) : null}
    </>
  );
}
