import type { Db, QmrRecord } from "@/lib/qmr-engine";
import { recChecks, rowChecks } from "@/lib/qmr-engine";

export type RecStatus = "empty" | "filled" | "flagged" | "final";

/** Visual state of a record on the shelf, derived from its items. */
export function recordStatus(db: Db, rec: QmrRecord): RecStatus {
  const items = rec.items;
  if (!items.length) return "empty";
  if (items.every((it) => it.review_state === "Final")) return "final";
  const anyBlank = items.some(
    (it) => !String(it.evaluation_text || "").trim() || !String(it.improvement_action || "").trim(),
  );
  if (anyBlank) return "empty";
  const flagged =
    items.some((it) => rowChecks(db, rec, it).some((f) => f.level === "error" || f.level === "warn")) ||
    recChecks(rec).length > 0;
  return flagged ? "flagged" : "filled";
}

export const STATUS_COLOR: Record<RecStatus, string> = {
  empty: "#9aa4b2",
  filled: "#24508f",
  flagged: "#e0902a",
  final: "#2e8b57",
};

export const STATUS_LABEL: Record<RecStatus, string> = {
  empty: "to fill",
  filled: "filled",
  flagged: "flagged",
  final: "final",
};
