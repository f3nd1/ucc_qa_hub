import type { Db } from "../qmr-engine/types";
import { DB_KEY, normalizeDb } from "../qmr-engine/db";
import type { StorageAdapter } from "./types";

/* Local-first persistence, matching the original tool's single-blob shape
   and debounced write. SSR-safe: every method no-ops without `window`. */

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const localStorageAdapter: StorageAdapter = {
  load() {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(DB_KEY);
      return raw ? normalizeDb(JSON.parse(raw)) : null;
    } catch (e) {
      console.error("DB load failed", e);
      return null;
    }
  },
  save(db: Db) {
    if (typeof window === "undefined") return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        window.localStorage.setItem(DB_KEY, JSON.stringify(db));
      } catch (e) {
        console.error("Save failed (storage full?)", e);
      }
    }, 150);
  },
};
