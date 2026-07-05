import type { Cycle, Db, QmrRecord, Settings } from "./types";

/** localStorage key, kept identical so an existing tool's blob loads unchanged. */
export const DB_KEY = "qmrwb_db_v2";

/** A fresh, empty Db value (matches the original tool's initial db literal). */
export function emptyDb(): Db {
  return {
    settings: {},
    procedures: {},
    requirements: {},
    driveLinks: {},
    exemplars: { met: "", nil: "", short: "" },
    activeCycle: null,
    cycles: {},
    noteBank: {},
    agents: [],
  };
}

/**
 * Defensive defaulting, ported from loadDB(): a persisted blob may predate a
 * field, so fill any missing top-level keys before use.
 */
export function normalizeDb(raw: unknown): Db {
  const db = (raw && typeof raw === "object" ? raw : emptyDb()) as Db;
  if (!db.settings) db.settings = {};
  if (!db.procedures) db.procedures = {};
  if (!db.requirements) db.requirements = {};
  if (!db.driveLinks) db.driveLinks = {};
  if (!db.exemplars) db.exemplars = { met: "", nil: "", short: "" };
  if (!db.cycles) db.cycles = {};
  if (!db.noteBank) db.noteBank = {};
  if (!db.agents) db.agents = [];
  if (db.activeCycle === undefined) db.activeCycle = null;
  return db;
}

/* ---- accessors (pure reads) ---- */

export function getS(db: Db): Settings {
  return db.settings || {};
}

export function activeCycle(db: Db): Cycle | null {
  return db.activeCycle ? db.cycles[db.activeCycle] || null : null;
}

export function records(db: Db): Record<string, QmrRecord> {
  const c = activeCycle(db);
  return c ? c.records : {};
}

/** Record names in the active cycle, sorted (the sidebar order). */
export function recordOrder(db: Db): string[] {
  const c = activeCycle(db);
  if (!c) return [];
  return Object.keys(c.records).sort();
}

/** Stable key for the note bank: criterion + activity name. */
export function activityKey(
  rec: { criterion?: string },
  item: { activity_name?: string; name?: string },
): string {
  return (rec.criterion || "?") + "::" + (item.activity_name || item.name || "?");
}
