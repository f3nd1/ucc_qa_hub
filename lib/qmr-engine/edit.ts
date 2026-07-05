import type { Db, Item } from "./types";
import { activityKey, records } from "./db";
import { clone } from "./util";

/* =========================================================
   FIELD EDITS

   The original tool edited DOM inputs then read them back into the
   row. In React we patch the item explicitly. Pure: returns a new Db.
   ========================================================= */

/** Shallow-merge a patch into one activity. */
export function updateItem(db: Db, parent: string, childName: string, patch: Partial<Item>): Db {
  const rec = records(db)[parent];
  if (!rec || !rec.items.some((i) => i.name === childName)) return db;
  const d = clone(db);
  const row = records(d)[parent].items.find((i) => i.name === childName)!;
  Object.assign(row, patch);
  return d;
}

/** Persist (or clear) this activity's note into the shared note bank. */
export function saveNoteToBank(db: Db, parent: string, childName: string): Db {
  const rec = records(db)[parent];
  const row = rec?.items.find((i) => i.name === childName);
  if (!rec || !row) return db;
  const d = clone(db);
  const key = activityKey(rec, row);
  if (String(row._note || "").trim()) d.noteBank[key] = row._note.trim();
  else delete d.noteBank[key];
  return d;
}
