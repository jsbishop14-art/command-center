"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  saveBuildProjectsAction,
  saveBuildBudgetAction,
  type BudgetSettingsResult,
} from "@/app/(app)/settings/builds-actions";
import type { Project } from "@/lib/builds/types";

// Settings → Software builds (handoff §7.1): edit the tracked projects (name + repo) and the build
// budget limit and warning percentage. The projects list is a local setting; the limit and warning
// are written to build-control/budget.json.

function SaveButton({ label, testid }: { label: string; testid: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn accent" data-testid={testid} disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

export default function BuildsSettingsPanel({
  projects,
  limit,
  warnPct,
}: {
  projects: Project[];
  limit: number | null;
  warnPct: number;
}) {
  const [rows, setRows] = useState<Project[]>(projects.length ? projects : [{ name: "", repo: "" }]);
  const [, saveProjects] = useFormState(saveBuildProjectsAction, { ok: false });
  const [budgetResult, saveBudget] = useFormState<BudgetSettingsResult | null, FormData>(
    saveBuildBudgetAction,
    null,
  );

  return (
    <div className="builds-settings">
      <form action={saveProjects}>
        <div className="subtle" style={{ marginBottom: 8 }}>Tracked projects. Each is a name and its GitHub repo.</div>
        <div className="builds-proj-rows">
          {rows.map((r, i) => (
            <div key={i} className="builds-proj-row">
              <input
                name="name"
                placeholder="Project name"
                defaultValue={r.name}
                data-testid={`proj-name-${i}`}
                onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <input
                name="repo"
                placeholder="owner/repo"
                defaultValue={r.repo}
                data-testid={`proj-repo-${i}`}
                onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, repo: e.target.value } : x)))}
              />
              <button
                type="button"
                className="btn ghost"
                data-testid={`proj-remove-${i}`}
                onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs))}
                aria-label="Remove project"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="builds-settings-actions">
          <button type="button" className="btn ghost" data-testid="proj-add" onClick={() => setRows((rs) => [...rs, { name: "", repo: "" }])}>
            Add project
          </button>
          <SaveButton label="Save projects" testid="proj-save" />
        </div>
      </form>

      <form action={saveBudget} className="builds-budget-form">
        <div className="subtle" style={{ margin: "12px 0 8px" }}>
          Build budget (builds only, not Sync). Blank limit records usage with no hold.
        </div>
        <label className="builds-field">
          Weekly limit (tokens)
          <input name="weekly_limit_tokens" defaultValue={limit ?? ""} placeholder="e.g. 40000000" data-testid="budget-limit" />
        </label>
        <label className="builds-field">
          Warning at (%)
          <input name="warn_pct" defaultValue={warnPct} data-testid="budget-warn-pct" />
        </label>
        {budgetResult && "error" in budgetResult ? (
          <span className="error" role="alert">{budgetResult.error}</span>
        ) : null}
        {budgetResult && "ok" in budgetResult ? <span className="subtle" data-testid="budget-saved">Saved.</span> : null}
        <div className="builds-settings-actions">
          <SaveButton label="Save budget" testid="budget-save" />
        </div>
      </form>

      <p className="subtle" style={{ marginTop: 10 }}>
        Command Center reads your GitHub repos with the token in Keys above. See{" "}
        <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">docs/guides/github_token.md</a> for how to create it.
      </p>
    </div>
  );
}
