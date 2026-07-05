"use client";

import { useState } from "react";
import { store, useDb } from "@/lib/store/store";
import {
  activeCycle,
  aiDraft,
  exportFlat,
  exportImportCSV,
  exportProject,
  loadDemo,
  MIGRATION_SQL,
  recordOrder,
  records,
  setProcedure,
  setReview,
  updateItem,
  DEMO_PROC,
} from "@/lib/qmr-engine";
import type { Item, ReviewState, Settings } from "@/lib/qmr-engine";
import { RecordCard } from "./RecordCard";
import { SettingsPanel } from "./SettingsPanel";
import { download } from "./download";
import { rowKey } from "@/lib/qmr-engine";
import { AgentOffice } from "../phase2/AgentOffice";
import type { Notify } from "../useWorkbench";

/**
 * Flat view (Records + Agent office tabs). The proven Phase 1/2 UI, now one
 * of two shells. The toast and store hydration are owned by AppShell.
 */
export function DemoWorkbench({ notify, onSetMode }: { notify: Notify; onSetMode?: () => void }) {
  const db = useDb();
  const [busyName, setBusyName] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState<"records" | "agents">("records");

  const order = recordOrder(db);
  const cycleName = activeCycle(db)?.name || "none";

  /* ---- handlers ---- */

  function onLoadDemo() {
    store.set(loadDemo(db));
    notify("Demo loaded: 3 records, procedures + GD4 requirements, exemplars.", "ok");
  }

  function onSaveSettings(patch: Settings) {
    store.set({ ...db, settings: { ...db.settings, ...patch } });
    setShowSettings(false);
    notify("Settings saved.", "ok");
  }

  function onClearProc(criterion: string) {
    store.set(setProcedure(db, criterion, ""));
    notify("Procedure cleared for " + criterion + " — drafting will now refuse.", "err");
  }

  function onRestoreProc(criterion: string) {
    store.set(setProcedure(db, criterion, DEMO_PROC[criterion] || ""));
    notify("Procedure restored for " + criterion + ".", "ok");
  }

  async function onDraft(parent: string, childName: string) {
    const key = rowKey(parent, childName);
    setBusyName(key);
    try {
      const r = await aiDraft(db, parent, childName);
      store.set(r.db);
      notify(r.message, r.status === "drafted" ? "ok" : r.status === "error" ? "err" : "info");
    } finally {
      setBusyName(null);
    }
  }

  function onPatch(parent: string, childName: string, patch: Partial<Item>) {
    store.set(updateItem(db, parent, childName, patch));
  }

  function onReview(parent: string, childName: string, state: ReviewState) {
    const r = setReview(db, parent, childName, state);
    store.set(r.db);
    notify(r.message, r.status === "blocked" ? "err" : "ok");
  }

  function onExport(kind: "flat" | "import" | "project" | "migration") {
    if (kind === "migration") {
      download("qmr_supabase_migration.sql", MIGRATION_SQL, "sql");
      notify("Migration SQL downloaded.", "ok");
      return;
    }
    const res =
      kind === "flat" ? exportFlat(db) : kind === "import" ? exportImportCSV(db) : exportProject(db);
    if (res.error) {
      notify(res.error, "err");
      return;
    }
    if (res.file) {
      download(res.file.filename, res.file.text, res.file.mime);
      notify(res.file.filename + " downloaded.", "ok");
    }
  }

  return (
    <div>
      {/* topbar */}
      <div
        style={{
          background: "var(--navy)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 14px",
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ fontSize: 15, margin: 0, fontWeight: 600, letterSpacing: 0.3 }}>
          QMR Agent Office
        </h1>
        <span
          style={{
            background: "rgba(255,255,255,.14)",
            border: "1px solid rgba(255,255,255,.3)",
            borderRadius: 14,
            padding: "3px 12px",
            fontSize: 12,
          }}
        >
          Cycle: <b>{cycleName}</b>
        </span>
        <span style={{ fontSize: 11.5, opacity: 0.75 }}>Phase 2 · agent office</span>
        <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          {(["records", "agents"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: tab === t ? "#fff" : "rgba(255,255,255,.12)",
                color: tab === t ? "var(--navy)" : "#fff",
                border: "1px solid rgba(255,255,255,.32)",
                borderRadius: 4,
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: tab === t ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {t === "records" ? "Records" : "Agent office"}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {onSetMode && (
            <button style={{ ...tbBtn, background: "rgba(255,255,255,.22)" }} onClick={onSetMode}>
              3D office
            </button>
          )}
          <button style={tbBtn} onClick={onLoadDemo}>
            Load demo
          </button>
          <button style={tbBtn} onClick={() => onExport("flat")}>
            Export flat CSV
          </button>
          <button style={tbBtn} onClick={() => onExport("import")}>
            Data Import CSV
          </button>
          <button style={tbBtn} onClick={() => onExport("project")}>
            Save project
          </button>
          <button style={tbBtn} onClick={() => onExport("migration")}>
            Migration SQL
          </button>
          <button style={{ ...tbBtn, background: "#fff", color: "var(--navy)", fontWeight: 600 }} onClick={() => setShowSettings((s) => !s)}>
            Settings
          </button>
        </div>
      </div>

      <div style={{ padding: "16px 20px 70px", maxWidth: 1120 }}>
        {showSettings && (
          <SettingsPanel settings={db.settings} onSave={onSaveSettings} onClose={() => setShowSettings(false)} />
        )}

        {tab === "agents" ? (
          <AgentOffice />
        ) : order.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--border)",
              borderRadius: 8,
              background: "#fafbfd",
              padding: 30,
              textAlign: "center",
              color: "var(--muted)",
              marginTop: 24,
            }}
          >
            <p style={{ marginTop: 0 }}>
              <b style={{ color: "var(--navy)" }}>Phase 1 proving page.</b> Press <b>Load demo</b> to bring in
              three records.
            </p>
            <div style={{ textAlign: "left", maxWidth: 640, margin: "12px auto 0", lineHeight: 1.7 }}>
              To see the <b>refuse rule</b> with no API key: load the demo, then on any record press{" "}
              <b>Clear procedure</b> and <b>Draft this activity</b>. The draft is blocked with a precise
              question, and no network call is made. Add an OpenAI key in Settings to run a real grounded
              draft.
            </div>
          </div>
        ) : (
          order.map((p) => (
            <RecordCard
              key={p}
              db={db}
              record={records(db)[p]}
              busyName={busyName}
              onDraft={(name) => onDraft(p, name)}
              onPatch={(name, patch) => onPatch(p, name, patch)}
              onReview={(name, state) => onReview(p, name, state)}
              onClearProc={onClearProc}
              onRestoreProc={onRestoreProc}
            />
          ))
        )}
      </div>
    </div>
  );
}

const tbBtn: React.CSSProperties = {
  background: "rgba(255,255,255,.12)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,.32)",
  borderRadius: 4,
  padding: "5px 9px",
  fontSize: 12,
  whiteSpace: "nowrap",
  cursor: "pointer",
};
