import type { CheckFlag, Db, Item, QmrRecord } from "./types";
import { getProcedure, getRequirement } from "./criteria";

/* =========================================================
   CHECKS (ported from rowChecks / recChecks)
   These are deterministic and run with no API call.
   ========================================================= */

const STOP = new Set([
  "the", "of", "and", "to", "for", "a", "an", "in", "on", "with", "is", "are",
  "all", "rate", "completion", "completed", "review", "records", "record",
  "process", "procedure", "measures", "tracks", "ensures", "whether",
  "student", "students",
]);

/** Content words (>3 chars, not stop words) used for the off-topic check. */
export function keywords(s: string): string[] {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

/** Per-activity findings for the check rail. */
export function rowChecks(db: Db, rec: QmrRecord, row: Item): CheckFlag[] {
  const f: CheckFlag[] = [];
  const t = row.kpi_target_value,
    a = row.kpi_actual_value;
  const ev = String(row.evaluation_text || "").trim();
  const imp = String(row.improvement_action || "").trim();

  if (!ev) f.push({ level: "error", msg: "Evaluation Text is blank." });
  if (!imp) f.push({ level: "error", msg: "Improvement Action is blank." });
  if (a === null) f.push({ level: "error", msg: "KPI Actual Value not keyed in." });
  if (ev && /\[[^\]]+\]/.test(ev + imp))
    f.push({ level: "error", msg: "Placeholder text like […] still present — fill it in." });

  if (t !== null && a !== null && a < t) {
    if (row.action_status === "Completed")
      f.push({ level: "warn", msg: "Actual (" + a + ") below target (" + t + ") but status is Completed." });
    if (ev && !/shortfall|below|not (fully )?met|partial|delay|gap|did not|only|however/i.test(ev))
      f.push({ level: "warn", msg: "Actual below target but evaluation does not acknowledge the shortfall." });
  }

  if (a === 0 && t !== null && t > 0 && ev && !/no .*(period|cases|requests|occurred)|remain(s)? in place|readiness/i.test(ev))
    f.push({ level: "info", msg: "Actual is 0 — if nil-activity, say so explicitly." });

  if (ev) {
    const kws = keywords(row.activity_name + " " + row.kpi_metric);
    const low = ev.toLowerCase();
    if (kws.length >= 2 && !kws.some((k) => low.includes(k)))
      f.push({
        level: "warn",
        msg: "Evaluation shares no keywords with this activity — possible copy from another activity.",
      });
  }

  if (!getProcedure(db, rec.criterion))
    f.push({
      level: "info",
      msg: "No procedure loaded for " + (rec.criterion || "this criterion") + " — AI drafts will be blocked.",
    });
  else if (!getRequirement(db, rec.criterion))
    f.push({
      level: "info",
      msg: "No GD4 requirement loaded for " + (rec.criterion || "this criterion") + " — drafts will be less audit-aligned.",
    });

  if (row.review_state === "Final" && (!ev || !imp))
    f.push({ level: "error", msg: "Marked Final but a narrative field is blank." });

  return f;
}

/** Whole-record findings (duplicate KPI metric across activities). */
export function recChecks(rec: QmrRecord): CheckFlag[] {
  const f: CheckFlag[] = [];
  const mc: Record<string, number> = {};
  rec.items.forEach((it) => {
    const m = String(it.kpi_metric || "").trim().toLowerCase();
    if (m) mc[m] = (mc[m] || 0) + 1;
  });
  Object.entries(mc).forEach(([m, c]) => {
    if (c > 1)
      f.push({ level: "warn", msg: "KPI metric “" + m + "” on " + c + " activities — check for copy-over." });
  });
  return f;
}
