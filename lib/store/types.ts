import type { Db } from "../qmr-engine/types";

/**
 * Persistence seam. Phase 1 ships a localStorage adapter; a Supabase
 * adapter implementing the same interface lands in a later phase.
 */
export interface StorageAdapter {
  /** Return the persisted Db, or null if none / unavailable (e.g. SSR). */
  load(): Db | null;
  /** Persist the Db (may debounce internally). No-op when unavailable. */
  save(db: Db): void;
}
