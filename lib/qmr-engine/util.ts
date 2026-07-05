/* Small pure helpers ported from qmr-workbench.html. */

/** Parse a numeric field; blank/invalid becomes null (never NaN). */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

/** Cycle id generator (kept identical to the original tool). */
export function uid(): string {
  return "cy_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}

/** Dirty-tracking key: parent record name + child item name. */
export function rowKey(parent: string, child: string): string {
  return parent + "||" + child;
}

/**
 * Deep clone used at every mutation boundary so engine functions stay pure:
 * they take a Db value and return a new one, never mutating the input.
 */
export function clone<T>(v: T): T {
  return structuredClone(v);
}
