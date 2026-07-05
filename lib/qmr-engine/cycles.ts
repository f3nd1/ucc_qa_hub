import type { Cycle, Db } from "./types";
import { activityKey, recordOrder } from "./db";
import { clone, uid } from "./util";

/* =========================================================
   CYCLE MANAGEMENT (ported from createCycle / switch / delete / rename)

   Carry-forward seeds a new cycle from a previous one: it copies the
   records and last cycle's narratives as a starting point, resetting
   actuals and review state. Notes come from the shared note bank.
   ========================================================= */

export interface CreateCycleResult {
  db: Db;
  cycleId: string;
}

export function createCycle(
  db: Db,
  name: string,
  from: string,
  to: string,
  seedFromId: string | null,
  created: string = new Date().toISOString(),
): CreateCycleResult {
  const d = clone(db);
  const id = uid();
  const cyc: Cycle = {
    id,
    name: name || "Untitled cycle",
    period_from: from || "",
    period_to: to || "",
    created,
    seededFrom: seedFromId || null,
    records: {},
  };

  if (seedFromId && d.cycles[seedFromId]) {
    const src = d.cycles[seedFromId];
    Object.values(src.records).forEach((rec) => {
      cyc.records[rec.name] = {
        name: rec.name,
        department: rec.department,
        criterion: rec.criterion,
        period_from: from || "",
        period_to: to || "",
        items: rec.items.map((it) => ({
          name: it.name,
          activity_name: it.activity_name,
          feedback_source: it.feedback_source,
          frequency: it.frequency,
          timing: it.timing,
          ownership: it.ownership,
          kpi_metric: it.kpi_metric,
          kpi_target_value: it.kpi_target_value,
          kpi_actual_value: null,
          uom: it.uom,
          kpi_target_desc: it.kpi_target_desc,
          evaluation_text: "",
          improvement_action: "",
          action_status: "Planned",
          review_state: "Draft",
          reviewed_by: "",
          reviewed_on: "",
          evidence_text: "",
          _note: d.noteBank[activityKey(rec, it)] || "",
          _refusal: null,
          _critique: null,
          _carry: {
            evaluation_text: it.evaluation_text || "",
            improvement_action: it.improvement_action || "",
          },
        })),
      };
    });
  }

  d.cycles[id] = cyc;
  d.activeCycle = id;
  return { db: d, cycleId: id };
}

export function switchCycle(db: Db, id: string): Db {
  if (!db.cycles[id]) return db;
  const d = clone(db);
  d.activeCycle = id;
  return d;
}

/** Delete a cycle (the UI is responsible for confirming first). */
export function deleteCycle(db: Db, id: string): Db {
  if (!db.cycles[id]) return db;
  const d = clone(db);
  delete d.cycles[id];
  if (d.activeCycle === id) d.activeCycle = Object.keys(d.cycles)[0] || null;
  return d;
}

export function renameCycle(db: Db, id: string, newName: string): Db {
  const c = db.cycles[id];
  if (!c) return db;
  const d = clone(db);
  d.cycles[id].name = newName.trim() || c.name;
  return d;
}

/** First record name in a cycle, for default selection after a switch. */
export function firstRecord(db: Db): string | null {
  return recordOrder(db)[0] || null;
}
