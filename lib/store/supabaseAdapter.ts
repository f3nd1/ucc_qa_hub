import type { StorageAdapter } from "./types";

/* =========================================================
   SUPABASE ADAPTER — STUB (Phase 5)

   Implements the same StorageAdapter seam as localStorage so the app
   can swap persistence without touching the engine. Wired up when
   Supabase sync lands; the schema is in supabase/migrations/0001_init.sql.
   ========================================================= */

export const supabaseAdapter: StorageAdapter = {
  load() {
    throw new Error("Supabase adapter is wired in a later phase.");
  },
  save() {
    throw new Error("Supabase adapter is wired in a later phase.");
  },
};
