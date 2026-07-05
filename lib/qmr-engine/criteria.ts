import type { Db, QmrRecord } from "./types";
import { clone } from "./util";

/* =========================================================
   PROCEDURE / REQUIREMENT / DRIVE LIBRARY
   All shared across cycles. Setters return a new Db.
   ========================================================= */

export function getProcedure(db: Db, criterion: string): string {
  return (db.procedures || {})[criterion] || "";
}
export function setProcedure(db: Db, criterion: string, text: string): Db {
  if (!criterion) return db;
  const d = clone(db);
  if (text && text.trim()) d.procedures[criterion] = text.trim();
  else delete d.procedures[criterion];
  return d;
}

export function getRequirement(db: Db, criterion: string): string {
  return (db.requirements || {})[criterion] || "";
}
export function setRequirement(db: Db, criterion: string, text: string): Db {
  if (!criterion) return db;
  const d = clone(db);
  if (text && text.trim()) d.requirements[criterion] = text.trim();
  else delete d.requirements[criterion];
  return d;
}

export function getDriveLink(db: Db, criterion: string): string {
  return (db.driveLinks || {})[criterion] || "";
}
export function setDriveLink(db: Db, criterion: string, url: string): Db {
  if (!criterion) return db;
  const d = clone(db);
  if (url && url.trim()) d.driveLinks[criterion] = url.trim();
  else delete d.driveLinks[criterion];
  return d;
}

/** A criterion is ready to draft only when a procedure is present. */
export function criterionReady(db: Db, criterion: string): boolean {
  return !!getProcedure(db, criterion);
}

export interface Grounding {
  requirement: string;
  procedure: string;
  drive: string;
}
export function criterionGrounding(db: Db, criterion: string): Grounding {
  return {
    requirement: getRequirement(db, criterion),
    procedure: getProcedure(db, criterion),
    drive: getDriveLink(db, criterion),
  };
}

/* =========================================================
   Criterion parsing + filtering (GD4_<main>.<sub>.<seq>)
   ========================================================= */

export interface ParsedCriterion {
  main: string | null;
  sub: string | null;
  seq: string | null;
  mainKey: string;
  subKey: string;
}

export function parseCriterion(cr: string): ParsedCriterion {
  const m = String(cr || "").match(/GD4[_-]?(\d+)\.(\d+)(?:\.(\d+))?/i);
  if (!m) return { main: null, sub: null, seq: null, mainKey: "(other)", subKey: "(other)" };
  return {
    main: m[1],
    sub: m[2],
    seq: m[3] || null,
    mainKey: "GD4." + m[1],
    subKey: "GD4_" + m[1] + "." + m[2],
  };
}

export interface Filter {
  main: string;
  sub: string;
  department: string;
  status: string;
  review: string;
}
export function emptyFilter(): Filter {
  return { main: "", sub: "", department: "", status: "", review: "" };
}
export function filterActive(f: Filter): boolean {
  return !!(f.main || f.sub || f.department || f.status || f.review);
}
export function recordPassesFilter(rec: QmrRecord, f: Filter): boolean {
  const pc = parseCriterion(rec.criterion);
  if (f.main && pc.main !== f.main) return false;
  if (f.sub && pc.subKey !== f.sub) return false;
  if (f.department && rec.department !== f.department) return false;
  if (f.status || f.review) {
    // record passes if ANY item matches the item-level filters
    const anyItem = rec.items.some(
      (it) =>
        (!f.status || it.action_status === f.status) &&
        (!f.review || (it.review_state || "Draft") === f.review),
    );
    if (!anyItem) return false;
  }
  return true;
}
