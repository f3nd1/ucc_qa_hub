import type { Db } from "./types";
import { activeCycle, records } from "./db";
import { clone } from "./util";

/* =========================================================
   LOCAL QUICK-FILL (no API) and carry-forward, ported from
   localDraft / the bulk carry-forward. Pure: return a new Db.
   ========================================================= */

export type QuickMode = "met" | "nil" | "short";

export function localDraft(db: Db, parent: string, name: string, mode: QuickMode): Db {
  const rec0 = records(db)[parent];
  if (!rec0 || !rec0.items.some((r) => r.name === name)) return db;
  const d = clone(db);
  const row = records(d)[parent].items.find((r) => r.name === name)!;

  const act = row.activity_name || "This activity";
  const fs = row.feedback_source ? String(row.feedback_source).replace(/\.$/, "") : "the relevant records";
  const t = row.kpi_target_value;
  const uom = row.uom === "%" ? "%" : row.uom ? " " + row.uom : "";
  const note = String(row._note || "").trim();

  if (mode === "met") {
    if (row.kpi_actual_value === null && t !== null) row.kpi_actual_value = t;
    const a = row.kpi_actual_value;
    row.evaluation_text =
      act + " was completed as required during the monitoring period, achieving " + a + uom + " against a target of " + t + uom + ". Evidence is maintained in " + fs + ".";
    row.improvement_action = "Maintain the current controls for this activity and continue recording evidence in " + fs + ".";
    row.action_status = "Completed";
  } else if (mode === "nil") {
    row.kpi_actual_value = 0;
    row.evaluation_text =
      "No cases arose under this activity (" + act + ") during the monitoring period. The related controls and procedures remain in place and ready for use when required.";
    row.improvement_action = "Maintain readiness of the " + act + " process and apply it whenever cases arise.";
    row.action_status = "Completed";
  } else if (mode === "short") {
    const a = row.kpi_actual_value;
    const cause = note ? note : "[state the cause]";
    row.evaluation_text =
      act + " achieved " + (a === null ? "[actual]" : a + uom) + " against a target of " + (t === null ? "[target]" : t + uom) + ". The shortfall arose because " + cause + ".";
    row.improvement_action =
      "Raise a Quality Action to address the shortfall, with " +
      (note ? "the cause (" + note + ") resolved by a named owner within a set deadline" : "[the corrective step, owner, and deadline stated]") +
      ".";
    if (row.action_status === "Planned") row.action_status = "In Progress";
  }

  row._refusal = null;
  if (row.review_state === "Final") row.review_state = "Under Review";
  return d;
}

export interface CarryResult {
  db: Db;
  n: number; // -1 signals: this cycle was not carried forward
}

/** Pull the prior cycle's narrative into any empty activity of the active cycle. */
export function carryForwardEmpties(db: Db): CarryResult {
  const c = activeCycle(db);
  if (!c || !c.seededFrom) return { db, n: -1 };
  const d = clone(db);
  const cc = activeCycle(d)!;
  let n = 0;
  Object.values(cc.records).forEach((rec) =>
    rec.items.forEach((it) => {
      if (it._carry && (it._carry.evaluation_text || it._carry.improvement_action) && !String(it.evaluation_text || "").trim()) {
        it.evaluation_text = it._carry.evaluation_text || "";
        it.improvement_action = it._carry.improvement_action || "";
        if (it.review_state === "Final") it.review_state = "Under Review";
        n++;
      }
    }),
  );
  return { db: d, n };
}
