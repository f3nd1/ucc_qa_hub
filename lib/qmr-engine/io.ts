import type { Db } from "./types";
import { activeCycle, recordOrder, records } from "./db";
import { normalizeDb } from "./db";

/* =========================================================
   EXPORTS / PROJECT I/O (ported from exportFlat / exportImport /
   exportProject / importProject)

   Engine functions build the file text only. Triggering the browser
   download is a UI concern.
   ========================================================= */

export interface ExportFile {
  filename: string;
  text: string;
  mime: "csv" | "json";
}
export interface ExportResult {
  file?: ExportFile;
  error?: string;
}

function csvCell(v: unknown): string {
  const s = String(v == null ? "" : v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function cycleSlug(db: Db): string {
  return (activeCycle(db)?.name || "cycle").replace(/\s+/g, "_");
}

/** Flat CSV, one row per activity, for human review. */
export function exportFlat(db: Db): ExportResult {
  const order = recordOrder(db);
  if (!order.length) return { error: "Nothing loaded." };
  const cols = [
    "parent", "name", "department", "criterion", "activity_name", "feedback_source",
    "frequency", "timing", "ownership", "kpi_metric", "kpi_target_value", "kpi_actual_value",
    "uom", "kpi_target_desc", "evaluation_text", "improvement_action", "action_status",
    "review_state", "reviewed_by", "reviewed_on",
  ];
  const lines = [cols.join(",")];
  order.forEach((p) => {
    const rec = records(db)[p];
    rec.items.forEach((it) => {
      lines.push(
        cols
          .map((c) =>
            c === "parent"
              ? csvCell(p)
              : c === "department"
                ? csvCell(rec.department)
                : c === "criterion"
                  ? csvCell(rec.criterion)
                  : csvCell((it as unknown as Record<string, unknown>)[c]),
          )
          .join(","),
      );
    });
  });
  return { file: { filename: "qmr_flat_" + cycleSlug(db) + ".csv", text: lines.join("\n"), mime: "csv" } };
}

/** ERPNext Data Import CSV (Update Records): parent on first child row only. */
export function exportImportCSV(db: Db): ExportResult {
  const order = recordOrder(db);
  if (!order.length) return { error: "Nothing loaded." };
  const header = [
    "ID", "ID (Items)", "KPI Actual Value (Items)", "Evaluation Text (Items)",
    "Improvement Action (Items)", "Action Status (Items)",
  ];
  const lines = [header.map(csvCell).join(",")];
  order.forEach((p) => {
    const rec = records(db)[p];
    rec.items.forEach((it, i) => {
      lines.push(
        [
          i === 0 ? p : "",
          it.name,
          it.kpi_actual_value == null ? "" : it.kpi_actual_value,
          it.evaluation_text || "",
          it.improvement_action || "",
          it.action_status || "",
        ]
          .map(csvCell)
          .join(","),
      );
    });
  });
  return {
    file: { filename: "qmr_data_import_" + cycleSlug(db) + ".csv", text: lines.join("\n"), mime: "csv" },
  };
}

/** Whole-project JSON snapshot (a faithful copy of the Db). */
export function exportProject(db: Db): ExportResult {
  return { file: { filename: "qmr_project.json", text: JSON.stringify(db, null, 2), mime: "json" } };
}

export interface ImportProjectResult {
  db?: Db;
  error?: string;
}

/** Load a project JSON back into a normalised Db. */
export function importProject(text: string): ImportProjectResult {
  try {
    const obj = JSON.parse(text);
    if (!obj || !obj.cycles) throw new Error("Not a QMR project file.");
    return { db: normalizeDb(obj) };
  } catch (e) {
    return { error: "Invalid project file: " + (e as Error).message };
  }
}
