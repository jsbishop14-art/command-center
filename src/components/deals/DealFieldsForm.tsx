"use client";

import { useState } from "react";
import { saveDealAction } from "@/app/(app)/deals/actions";
import { SALE_STAGES, DEV_STAGES, type DealType } from "@/lib/deals/types";

// The editable deal fields (handoff §3.3). A client form so the Stage options follow the Type
// (Sale vs Development). Submitting calls saveDealAction, which writes through the deal action layer.
export default function DealFieldsForm({
  id,
  type,
  stage,
  value,
  probability,
  currentTask,
  nextAction,
  nextActionDate,
  customerId,
  jobId,
  notes,
}: {
  id: number;
  type: DealType;
  stage: string;
  value: number | null;
  probability: number | null;
  currentTask: string;
  nextAction: string;
  nextActionDate: string | null;
  customerId: string | null;
  jobId: string | null;
  notes: string;
}) {
  const [curType, setType] = useState<DealType>(type);
  const stages = curType === "sale" ? SALE_STAGES : DEV_STAGES;
  // If the stored stage belongs to the other type (after switching), default to the first stage.
  const stageDefault = (stages as readonly string[]).includes(stage) ? stage : stages[0];

  return (
    <form action={saveDealAction} className="deal-fields">
      <input type="hidden" name="id" value={id} />

      <label className="subtle" htmlFor={`type-${id}`}>Type</label>
      <select id={`type-${id}`} name="type" value={curType} onChange={(e) => setType(e.target.value as DealType)} style={{ height: 32 }}>
        <option value="sale">Sale</option>
        <option value="development">Development</option>
      </select>

      <label className="subtle" htmlFor={`stage-${id}`}>Stage</label>
      <select id={`stage-${id}`} name="stage" defaultValue={stageDefault} key={curType} style={{ height: 32 }}>
        {stages.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <label className="subtle" htmlFor={`value-${id}`}>Value ($)</label>
      <input id={`value-${id}`} name="value" type="number" min="0" step="1" defaultValue={value ?? ""} style={{ height: 32 }} />

      <label className="subtle" htmlFor={`prob-${id}`}>Probability (%)</label>
      <input id={`prob-${id}`} name="probability" type="number" min="0" max="100" step="1" defaultValue={probability ?? ""} style={{ height: 32 }} />

      <label className="subtle" htmlFor={`task-${id}`}>Current task</label>
      <input id={`task-${id}`} name="currentTask" type="text" defaultValue={currentTask} style={{ height: 32 }} />

      <label className="subtle" htmlFor={`next-${id}`}>Next action</label>
      <input id={`next-${id}`} name="nextAction" type="text" defaultValue={nextAction} style={{ height: 32 }} />

      <label className="subtle" htmlFor={`date-${id}`}>Next action date</label>
      <input id={`date-${id}`} name="nextActionDate" type="date" defaultValue={nextActionDate ?? ""} style={{ height: 32 }} />

      <label className="subtle" htmlFor={`cust-${id}`}>Customer</label>
      <input id={`cust-${id}`} name="customerId" type="text" defaultValue={customerId ?? ""} placeholder="EZ Binder customer" style={{ height: 32 }} />

      <label className="subtle" htmlFor={`job-${id}`}>EZ Binder job</label>
      <input id={`job-${id}`} name="jobId" type="text" defaultValue={jobId ?? ""} placeholder="Linked once Won" style={{ height: 32 }} />

      <label className="subtle" htmlFor={`notes-${id}`} style={{ gridColumn: "1 / -1" }}>Notes</label>
      <textarea id={`notes-${id}`} name="notes" rows={3} defaultValue={notes} style={{ gridColumn: "1 / -1", font: "inherit", fontSize: 13, borderRadius: 8, border: "1px solid rgba(22,24,29,0.14)", padding: "8px 10px", resize: "vertical", background: "rgba(255,255,255,0.7)" }} />

      <button className="btn ghost" type="submit" style={{ gridColumn: "1 / -1", height: 32, justifySelf: "start" }} data-testid={`save-deal-${id}`}>
        Save deal
      </button>
    </form>
  );
}
