import { useSyncExternalStore } from "react";
import type { Db } from "../qmr-engine/types";
import { emptyDb } from "../qmr-engine/db";
import type { StorageAdapter } from "./types";
import { localStorageAdapter } from "./localStorageAdapter";

/* =========================================================
   Client store: holds the single Db value, notifies React via
   useSyncExternalStore, and persists through a StorageAdapter.

   Engine functions stay pure; the store is the one place that holds
   mutable state and talks to persistence.
   ========================================================= */

let state: Db = emptyDb();
const serverState: Db = emptyDb(); // stable reference for SSR snapshot
const listeners = new Set<() => void>();
const adapter: StorageAdapter = localStorageAdapter;
let hydrated = false;

function emit() {
  listeners.forEach((l) => l());
}

export const store = {
  getState: (): Db => state,
  getServerState: (): Db => serverState,
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  /** Replace the Db and persist. Callers pass the result of an engine function. */
  set(db: Db) {
    state = db;
    adapter.save(db);
    emit();
  },
  /** Load persisted state once, on the client, after mount. */
  hydrate() {
    if (hydrated) return;
    hydrated = true;
    const raw = adapter.load();
    if (raw) {
      state = raw;
      emit();
    }
  },
};

/** React hook: subscribe a component to the Db. */
export function useDb(): Db {
  return useSyncExternalStore(store.subscribe, store.getState, store.getServerState);
}
