import type { Db, ReviewState } from "./types";
import { getS, records } from "./db";
import { clone } from "./util";

/* =========================================================
   REVIEW / SIGN-OFF (ported from setReview / bulkFinalise)

   The finalise gate blocks Final on blank or placeholder text and
   stamps reviewer + date. "AI recommends, humans decide": nothing
   here auto-finalises.
   ========================================================= */

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface ReviewResult {
  db: Db;
  status: "ok" | "blocked" | "error";
  message: string;
}

const hasPlaceholder = (a: string, b: string): boolean => /\[[^\]]+\]/.test(a + b);

export function setReview(
  db: Db,
  parent: string,
  childName: string,
  stateVal: ReviewState,
  today: string = todayISO(),
): ReviewResult {
  const rec = records(db)[parent];
  if (!rec) return { db, status: "error", message: "Record not found." };
  const row0 = rec.items.find((r) => r.name === childName);
  if (!row0) return { db, status: "error", message: "Activity not found." };

  if (stateVal === "Final") {
    if (!String(row0.evaluation_text || "").trim() || !String(row0.improvement_action || "").trim())
      return {
        db,
        status: "blocked",
        message: "Cannot finalise: evaluation and improvement action must be filled.",
      };
    if (hasPlaceholder(row0.evaluation_text, row0.improvement_action))
      return { db, status: "blocked", message: "Cannot finalise: placeholder […] text still present." };
  }

  const d = clone(db);
  const row = records(d)[parent].items.find((r) => r.name === childName)!;
  if (stateVal === "Final") {
    row.reviewed_by = getS(d).reviewer || "";
    row.reviewed_on = today;
  }
  row.review_state = stateVal;
  return { db: d, status: "ok", message: "Review state set to " + stateVal + "." };
}

export interface BulkFinaliseResult {
  db: Db;
  done: number;
  blocked: number;
  message: string;
}

/** Promote every "Under Review" item that passes the finalise gate to Final. */
export function bulkFinalise(db: Db, today: string = todayISO()): BulkFinaliseResult {
  const d = clone(db);
  const reviewer = getS(d).reviewer || "";
  let done = 0,
    blocked = 0;
  Object.values(records(d)).forEach((rec) => {
    rec.items.forEach((it) => {
      if (it.review_state === "Under Review") {
        if (
          String(it.evaluation_text || "").trim() &&
          String(it.improvement_action || "").trim() &&
          !hasPlaceholder(it.evaluation_text, it.improvement_action)
        ) {
          it.review_state = "Final";
          it.reviewed_by = reviewer;
          it.reviewed_on = today;
          done++;
        } else blocked++;
      }
    });
  });
  return {
    db: d,
    done,
    blocked,
    message: "Finalised " + done + (blocked ? ", " + blocked + " blocked (blank or placeholder text)." : "."),
  };
}
