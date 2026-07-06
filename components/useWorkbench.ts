"use client";

import { useCallback } from "react";
import { store, useDb } from "@/lib/store/store";
import {
  aiDraft,
  bulkFinalise,
  carryForwardEmpties,
  consistencyPass,
  createCycle,
  deleteCycle,
  DEMO_PROC,
  exportFlat,
  exportImportCSV,
  exportProject,
  finaliseRecord,
  getProcedure,
  getS,
  importCSVIntoActive,
  importProject,
  loadDemo,
  localDraft,
  MIGRATION_SQL,
  recordOrder,
  records,
  renameCycle,
  saveNoteToBank,
  setDriveLink,
  setProcedure,
  setRequirement,
  setReview,
  switchCycle,
  updateItem,
} from "@/lib/qmr-engine";
import type { QuickMode } from "@/lib/qmr-engine";
import { erpConfig, fetchErpRecords, writeBackRecords } from "@/lib/qmr-engine";
import { pullProject, pushProject, supabaseConfig, supabaseConfigured } from "@/lib/store/supabaseSync";
import type { Agent, Item, ReviewState, Settings } from "@/lib/qmr-engine";
import { addAgent, removeAgent, toggleAgent, updateAgent } from "@/lib/agents";
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

  const saveCriterion = useCallback(
    (criterion: string, requirement: string, procedure: string, drive: string) => {
      let d = store.getState();
      d = setRequirement(d, criterion, requirement);
      d = setProcedure(d, criterion, procedure);
      d = setDriveLink(d, criterion, drive);
      store.set(d);
      notify("Saved grounding for " + criterion + ".", "ok");
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

  const quickFill = useCallback((parent: string, name: string, mode: QuickMode) => {
    store.set(localDraft(store.getState(), parent, name, mode));
  }, []);

  const setNote = useCallback((parent: string, name: string, value: string) => {
    let d = updateItem(store.getState(), parent, name, { _note: value });
    d = saveNoteToBank(d, parent, name);
    store.set(d);
  }, []);

  const useCarry = useCallback((parent: string, name: string) => {
    const st = store.getState();
    const it = (st.cycles[st.activeCycle || ""]?.records[parent]?.items || []).find((i) => i.name === name);
    if (!it?._carry) return;
    store.set(
      updateItem(st, parent, name, {
        evaluation_text: it._carry.evaluation_text || "",
        improvement_action: it._carry.improvement_action || "",
        _refusal: null,
        review_state: it.review_state === "Final" ? "Under Review" : it.review_state,
      }),
    );
  }, []);

  const draftRecordEmpties = useCallback(
    async (parent: string) => {
      const st0 = store.getState();
      const rec = st0.cycles[st0.activeCycle || ""]?.records[parent];
      if (!rec) return;
      const empties = rec.items.filter(
        (it) => !String(it.evaluation_text || "").trim() || !String(it.improvement_action || "").trim(),
      );
      if (!empties.length) {
        notify("No empty narratives in this record.", "info");
        return;
      }
      if (!getProcedure(st0, rec.criterion)) {
        notify("Add the SOP for " + (rec.criterion || "this criterion") + " first — AI stays grounded.", "err");
        return;
      }
      if (!getS(st0).openaiKey) {
        notify("Add your OpenAI API key in Settings.", "err");
        return;
      }
      notify("Drafting " + empties.length + "…", "info");
      for (const it of empties) {
        const r = await aiDraft(store.getState(), parent, it.name);
        store.set(r.db);
        await new Promise((x) => setTimeout(x, 300));
      }
      notify("Done — review each card.", "ok");
    },
    [notify],
  );

  const draftAllEmpties = useCallback(async () => {
    const st = store.getState();
    if (!getS(st).openaiKey) {
      notify("Add your OpenAI API key in Settings.", "err");
      return;
    }
    const tasks: Array<[string, string]> = [];
    recordOrder(st).forEach((p) => {
      records(st)[p].items.forEach((it) => {
        if (!String(it.evaluation_text || "").trim() || !String(it.improvement_action || "").trim()) tasks.push([p, it.name]);
      });
    });
    if (!tasks.length) {
      notify("No empty narratives across the cycle.", "info");
      return;
    }
    notify("Drafting " + tasks.length + "…", "info");
    for (const [p, n] of tasks) {
      const r = await aiDraft(store.getState(), p, n);
      store.set(r.db);
      await new Promise((x) => setTimeout(x, 300));
    }
    notify("Bulk drafting finished — review every card.", "ok");
  }, [notify]);

  const harmonise = useCallback(
    async (parent: string) => {
      const r = await consistencyPass(store.getState(), parent);
      store.set(r.db);
      notify(r.message, r.status === "drafted" ? "ok" : r.status === "error" ? "err" : "info");
    },
    [notify],
  );

  const finaliseRecordNow = useCallback(
    (parent: string) => {
      const r = finaliseRecord(store.getState(), parent);
      store.set(r.db);
      notify(r.message, r.blocked ? "err" : "ok");
    },
    [notify],
  );

  const carryForwardNow = useCallback(() => {
    const r = carryForwardEmpties(store.getState());
    if (r.n === -1) {
      notify("This cycle was not carried forward from another. Create a cycle with a seed source.", "err");
      return;
    }
    store.set(r.db);
    notify("Carried prior text into " + r.n + " empty activities.", "ok");
  }, [notify]);

  const importCSVNow = useCallback(
    (text: string) => {
      const r = importCSVIntoActive(store.getState(), text);
      if (r.error) {
        notify(r.error, "err");
        return;
      }
      store.set(r.db);
      notify("Imported " + r.added + " activities.", "ok");
    },
    [notify],
  );

  const loadProjectNow = useCallback(
    (text: string) => {
      const r = importProject(text);
      if (r.error || !r.db) {
        notify(r.error || "Invalid project file.", "err");
        return;
      }
      store.set(r.db);
      notify("Project loaded.", "ok");
    },
    [notify],
  );

  const toggleAgentNow = useCallback((id: string) => {
    store.set(toggleAgent(store.getState(), id));
  }, []);

  const updateAgentNow = useCallback((id: string, patch: Partial<Agent>) => {
    store.set(updateAgent(store.getState(), id, patch));
  }, []);

  const addAgentNow = useCallback(
    (agent: Agent) => {
      store.set(addAgent(store.getState(), agent));
      notify("Added agent “" + agent.name + "” — its desk is in the office.", "ok");
    },
    [notify],
  );

  const removeAgentNow = useCallback(
    (id: string, name: string) => {
      store.set(removeAgent(store.getState(), id));
      notify("Removed agent “" + name + "”.", "ok");
    },
    [notify],
  );

  const createCycleNow = useCallback(
    (name: string, from: string, to: string, seedId: string | null) => {
      const r = createCycle(store.getState(), name, from, to, seedId);
      store.set(r.db);
      notify(seedId ? "Cycle created, carried forward from the prior cycle." : "Cycle created.", "ok");
    },
    [notify],
  );

  const switchCycleNow = useCallback((id: string) => {
    store.set(switchCycle(store.getState(), id));
  }, []);

  const renameCycleNow = useCallback((id: string, name: string) => {
    store.set(renameCycle(store.getState(), id, name));
  }, []);

  const deleteCycleNow = useCallback(
    (id: string) => {
      store.set(deleteCycle(store.getState(), id));
      notify("Cycle deleted.", "ok");
    },
    [notify],
  );

  const bulkFinaliseNow = useCallback(() => {
    const r = bulkFinalise(store.getState());
    store.set(r.db);
    notify(r.message, r.blocked ? "err" : "ok");
  }, [notify]);

  const supabasePush = useCallback(async () => {
    const st = store.getState();
    const cfg = supabaseConfig(st.settings);
    if (!supabaseConfigured(cfg)) {
      notify("Set the Supabase URL and anon key in Settings.", "err");
      return;
    }
    try {
      await pushProject(cfg, st, new Date().toISOString());
      notify("Project saved to Supabase.", "ok");
    } catch (e) {
      notify("Supabase save failed: " + (e as Error).message, "err");
    }
  }, [notify]);

  const supabasePull = useCallback(async () => {
    const st = store.getState();
    const cfg = supabaseConfig(st.settings);
    if (!supabaseConfigured(cfg)) {
      notify("Set the Supabase URL and anon key in Settings.", "err");
      return;
    }
    try {
      const d = await pullProject(cfg);
      if (!d) {
        notify("No project found in Supabase yet.", "info");
        return;
      }
      store.set(d);
      notify("Project loaded from Supabase.", "ok");
    } catch (e) {
      notify("Supabase load failed: " + (e as Error).message, "err");
    }
  }, [notify]);

  const erpImport = useCallback(
    async (names: string[]) => {
      const st = store.getState();
      const d = await fetchErpRecords(st, erpConfig(st), names);
      store.set(d);
      notify("Loaded " + names.length + " record(s) from ERPNext.", "ok");
    },
    [notify],
  );

  const erpWriteBack = useCallback(
    async (parents: string[]) => {
      const st = store.getState();
      const r = await writeBackRecords(st, erpConfig(st), parents);
      notify(
        "Write-back: " + r.ok + " ok" + (r.failed.length ? ", " + r.failed.length + " failed" : "") + ".",
        r.failed.length ? "err" : "ok",
      );
      return r;
    },
    [notify],
  );

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

  return {
    db,
    loadDemoNow,
    saveSettings,
    clearProc,
    restoreProc,
    saveCriterion,
    patch,
    review,
    draft,
    toggleAgentNow,
    updateAgentNow,
    addAgentNow,
    removeAgentNow,
    createCycleNow,
    switchCycleNow,
    renameCycleNow,
    deleteCycleNow,
    bulkFinaliseNow,
    quickFill,
    setNote,
    useCarry,
    draftRecordEmpties,
    draftAllEmpties,
    harmonise,
    finaliseRecordNow,
    carryForwardNow,
    importCSVNow,
    loadProjectNow,
    supabasePush,
    supabasePull,
    erpImport,
    erpWriteBack,
    exportFile,
  };
}
