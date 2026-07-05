"use client";

import { useCallback } from "react";
import { store, useDb } from "@/lib/store/store";
import {
  aiDraft,
  DEMO_PROC,
  exportFlat,
  exportImportCSV,
  exportProject,
  loadDemo,
  MIGRATION_SQL,
  setProcedure,
  setReview,
  updateItem,
} from "@/lib/qmr-engine";
import type { Item, ReviewState, Settings } from "@/lib/qmr-engine";
import { toggleAgent } from "@/lib/agents";
import { download } from "./phase1/download";

export type ToastKind = "ok" | "err" | "info";
export type Notify = (text: string, kind?: ToastKind) => void;
export type ExportKind = "flat" | "import" | "project" | "migration";

/**
 * Shared workbench actions used by both the flat view and the 3D office.
 * Every action goes through the same engine functions, so the grounding and
 * refuse behaviour is identical regardless of which shell you are in.
 * Actions read store.getState() so they always act on the freshest Db.
 */
export function useWorkbench(notify: Notify) {
  const db = useDb();

  const loadDemoNow = useCallback(() => {
    store.set(loadDemo(store.getState()));
    notify("Demo loaded: 3 records, procedures + GD4 requirements, exemplars.", "ok");
  }, [notify]);

  const saveSettings = useCallback(
    (patch: Settings) => {
      const d = store.getState();
      store.set({ ...d, settings: { ...d.settings, ...patch } });
      notify("Settings saved.", "ok");
    },
    [notify],
  );

  const clearProc = useCallback(
    (criterion: string) => {
      store.set(setProcedure(store.getState(), criterion, ""));
      notify("Procedure cleared for " + criterion + " — drafting will now refuse.", "err");
    },
    [notify],
  );

  const restoreProc = useCallback(
    (criterion: string) => {
      store.set(setProcedure(store.getState(), criterion, DEMO_PROC[criterion] || ""));
      notify("Procedure restored for " + criterion + ".", "ok");
    },
    [notify],
  );

  const patch = useCallback((parent: string, name: string, p: Partial<Item>) => {
    store.set(updateItem(store.getState(), parent, name, p));
  }, []);

  const review = useCallback(
    (parent: string, name: string, state: ReviewState) => {
      const r = setReview(store.getState(), parent, name, state);
      store.set(r.db);
      notify(r.message, r.status === "blocked" ? "err" : "ok");
    },
    [notify],
  );

  const draft = useCallback(
    async (parent: string, name: string) => {
      const r = await aiDraft(store.getState(), parent, name);
      store.set(r.db);
      notify(r.message, r.status === "drafted" ? "ok" : r.status === "error" ? "err" : "info");
      return r.status;
    },
    [notify],
  );

  const toggleAgentNow = useCallback((id: string) => {
    store.set(toggleAgent(store.getState(), id));
  }, []);

  const exportFile = useCallback(
    (kind: ExportKind) => {
      if (kind === "migration") {
        download("qmr_supabase_migration.sql", MIGRATION_SQL, "sql");
        notify("Migration SQL downloaded.", "ok");
        return;
      }
      const st = store.getState();
      const res = kind === "flat" ? exportFlat(st) : kind === "import" ? exportImportCSV(st) : exportProject(st);
      if (res.error) {
        notify(res.error, "err");
        return;
      }
      if (res.file) {
        download(res.file.filename, res.file.text, res.file.mime);
        notify(res.file.filename + " downloaded.", "ok");
      }
    },
    [notify],
  );

  return { db, loadDemoNow, saveSettings, clearProc, restoreProc, patch, review, draft, toggleAgentNow, exportFile };
}
