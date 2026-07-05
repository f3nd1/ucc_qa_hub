import type { Item, Pattern } from "./types";

/**
 * Detect the pattern that drives which exemplars are sent and how the draft
 * is shaped. Ported verbatim from detectPattern():
 *   - actual is 0 against a positive target  -> "nil"   (no cases occurred)
 *   - actual below target                    -> "short" (acknowledge shortfall)
 *   - otherwise                              -> "met"
 */
export function detectPattern(row: Item): Pattern {
  const t = row.kpi_target_value;
  const a = row.kpi_actual_value;
  if (a !== null && a === 0 && t !== null && t > 0) return "nil";
  if (t !== null && a !== null && a < t) return "short";
  return "met";
}
