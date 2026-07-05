import type { Db, Item, QmrRecord } from "./types";
import { activeCycle, activityKey, recordOrder } from "./db";
import { clone, num } from "./util";

/* =========================================================
   CSV PARSING + IMPORT (ported from parseCSV / importCSVIntoActive)
   ========================================================= */

/** RFC-ish CSV parser handling quotes, escaped quotes, and CRLF. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        /* skip */
      } else field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ""));
}

const HEADER_MAP: Record<string, string> = {
  id: "name",
  name: "name",
  parent: "parent",
  "parent id": "parent",
  "quality monitoring record": "parent",
  "activity name": "activity_name",
  activity_name: "activity_name",
  "feedback source": "feedback_source",
  feedback_source: "feedback_source",
  frequency: "frequency",
  timing: "timing",
  ownership: "ownership",
  "kpi metric": "kpi_metric",
  kpi_metric: "kpi_metric",
  "kpi target value": "kpi_target_value",
  kpi_target_value: "kpi_target_value",
  "kpi actual value": "kpi_actual_value",
  kpi_actual_value: "kpi_actual_value",
  "kpi uom": "uom",
  uom: "uom",
  "kpi target description": "kpi_target_desc",
  kpi_target_desc: "kpi_target_desc",
  "evaluation text": "evaluation_text",
  evaluation_text: "evaluation_text",
  "improvement action": "improvement_action",
  improvement_action: "improvement_action",
  "action status": "action_status",
  action_status: "action_status",
  department: "department",
  criterion: "criterion",
  "period from": "period_from",
  period_from: "period_from",
  "period to": "period_to",
  period_to: "period_to",
};

function normHead(h: string): string {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s*\(.*\)\s*$/, "")
    .replace(/[_]+/g, " ")
    .trim();
}

/** Build an item from a parsed CSV row object, seeding its note from the bank. */
export function mkItem(db: Db, rec: { criterion?: string }, o: Record<string, string>): Item {
  const it: Item = {
    name: o.name,
    activity_name: o.activity_name || "",
    feedback_source: o.feedback_source || "",
    frequency: o.frequency || "",
    timing: o.timing || "",
    ownership: o.ownership || "",
    kpi_metric: o.kpi_metric || "",
    kpi_target_value: num(o.kpi_target_value),
    kpi_actual_value: num(o.kpi_actual_value),
    uom: o.uom || "",
    kpi_target_desc: o.kpi_target_desc || "",
    evaluation_text: o.evaluation_text || "",
    improvement_action: o.improvement_action || "",
    action_status: o.action_status || "Planned",
    review_state: "Draft",
    reviewed_by: "",
    reviewed_on: "",
    evidence_text: "",
    _note: "",
    _refusal: null,
    _critique: null,
    _carry: null,
  };
  it._note = db.noteBank[activityKey(rec, it)] || "";
  return it;
}

export interface ImportResult {
  db: Db;
  added: number;
  error?: string;
}

/** Import ERPNext-style CSV rows into the active cycle. */
export function importCSVIntoActive(db: Db, text: string): ImportResult {
  const c0 = activeCycle(db);
  if (!c0) return { db, added: 0, error: "Create or select a cycle first." };
  const rows = parseCSV(text);
  if (rows.length < 2) return { db, added: 0, error: "CSV appears empty." };
  const headers = rows[0].map(
    (h) => HEADER_MAP[String(h || "").trim().toLowerCase()] || HEADER_MAP[normHead(h)] || null,
  );
  if (!headers.includes("parent") || !headers.includes("name"))
    return { db, added: 0, error: "CSV must include Parent and ID columns." };

  const d = clone(db);
  const c = activeCycle(d)!;
  let added = 0;
  for (let r = 1; r < rows.length; r++) {
    const o: Record<string, string> = {};
    headers.forEach((fn, i) => {
      if (fn) o[fn] = rows[r][i];
    });
    if (!o.parent || !o.name) continue;
    if (!c.records[o.parent]) {
      c.records[o.parent] = {
        name: o.parent,
        department: o.department || "",
        criterion: o.criterion || "",
        period_from: o.period_from || c.period_from,
        period_to: o.period_to || c.period_to,
        items: [],
      } as QmrRecord;
    }
    const rec = c.records[o.parent];
    if (o.department && !rec.department) rec.department = o.department;
    if (o.criterion && !rec.criterion) rec.criterion = o.criterion;
    rec.items.push(mkItem(d, rec, o));
    added++;
  }
  return { db: d, added };
}

/** Convenience: the record to select after an import (first, sorted). */
export function firstAfterImport(db: Db): string | null {
  return recordOrder(db)[0] || null;
}
