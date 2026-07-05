"use client";

import { useEffect, useRef, useState } from "react";
import { activeCycle, emptyFilter, recordOrder, records } from "@/lib/qmr-engine";
import type { Filter } from "@/lib/qmr-engine";
import { rowKey } from "@/lib/qmr-engine";
import { useWorkbench } from "../useWorkbench";
import type { Notify } from "../useWorkbench";
import { Sidebar } from "../flat/Sidebar";
import { RecordView } from "../flat/RecordView";
import { Modal } from "../flat/Modal";
import { SettingsPanel } from "./SettingsPanel";
import { CycleManager } from "../office/CycleManager";
import { CriterionLibrary } from "../office/CriterionLibrary";
import { ErpNextPanel } from "../office/ErpNextPanel";
import { AgentOffice } from "../phase2/AgentOffice";

type ModalKind = "cycles" | "library" | "import" | "settings" | "agents" | "erpnext" | null;

/**
 * Flat view — a faithful reproduction of the original UCC QMR Workbench:
 * records sidebar (filters, bulk actions, badges) plus the full record editor.
 * One of two shells; the 3D office is a click away.
 */
export function DemoWorkbench({ notify, onSetMode }: { notify: Notify; onSetMode?: () => void }) {
  const wb = useWorkbench(notify);
  const db = wb.db;
  const order = recordOrder(db);

  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(emptyFilter());
  const [busyName, setBusyName] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [critPre, setCritPre] = useState<string | undefined>(undefined);
  const csvInput = useRef<HTMLInputElement>(null);
  const projInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (order.length && (!selected || !order.includes(selected))) setSelected(order[0]);
    if (!order.length && selected) setSelected(null);
  }, [order, selected]);

  useEffect(() => {
    if (!exportOpen) return;
    const h = () => setExportOpen(false);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [exportOpen]);

  async function onDraft(parent: string, name: string, final: boolean) {
    const key = rowKey(parent, name);
    setBusyName(key);
    try {
      await wb.draft(parent, name, final);
    } finally {
      setBusyName(null);
    }
  }

  function exp(kind: string) {
    setExportOpen(false);
    if (kind === "flat") wb.exportFile("flat");
    else if (kind === "import") wb.exportFile("import");
    else if (kind === "project") wb.exportFile("project");
    else if (kind === "migration") wb.exportFile("migration");
    else if (kind === "loadproject") projInput.current?.click();
    else if (kind === "writeback") setModal("erpnext");
    else if (kind === "supabase-push") wb.supabasePush();
    else if (kind === "supabase-pull") wb.supabasePull();
  }

  const rec = selected ? records(db)[selected] : null;
  const cyc = activeCycle(db);

  return (
    <div>
      <div className="topbar">
        <h1>UCC QMR Workbench</h1>
        <button className="cycle-pill" onClick={() => setModal("cycles")}>
          <span>Cycle:</span> <b>{cyc?.name || "none"}</b> <span style={{ opacity: 0.7 }}>▾</span>
        </button>
        <div className="tb-spacer" />
        {onSetMode && (
          <button className="tb-btn" onClick={onSetMode}>
            3D office
          </button>
        )}
        <button className="tb-btn" onClick={wb.loadDemoNow}>
          Load demo
        </button>
        <button className="tb-btn" onClick={() => setModal("agents")}>
          Agent office
        </button>
        <button className="tb-btn" onClick={() => { setCritPre(undefined); setModal("library"); }}>
          Criterion library
        </button>
        <button
          className="tb-btn"
          onClick={() => {
            if (!cyc) {
              notify("Create a cycle first.", "err");
              setModal("cycles");
              return;
            }
            setModal("import");
          }}
        >
          Import records
        </button>
        <div className="tb-menu-wrap" onClick={(e) => e.stopPropagation()}>
          <button className="tb-btn" onClick={() => setExportOpen((v) => !v)}>
            Export ▾
          </button>
          <div className={"tb-menu" + (exportOpen ? " open" : "")}>
            <div className="grp">Data out</div>
            <button onClick={() => exp("flat")}>Flat CSV (review)</button>
            <button onClick={() => exp("import")}>ERPNext Data Import CSV</button>
            <button onClick={() => exp("writeback")}>Write back to ERPNext (API)</button>
            <div className="grp">Whole project</div>
            <button onClick={() => exp("project")}>Save project file (.json)</button>
            <button onClick={() => exp("loadproject")}>Open project file</button>
            <div className="grp">Supabase (Codespace)</div>
            <button onClick={() => exp("supabase-push")}>Save to Supabase</button>
            <button onClick={() => exp("supabase-pull")}>Load from Supabase</button>
            <button onClick={() => exp("migration")}>Download migration SQL</button>
          </div>
        </div>
        <button className="tb-btn primary" onClick={() => setModal("settings")}>
          Settings
        </button>
      </div>

      <div className="layout">
        <Sidebar
          db={db}
          filter={filter}
          onFilter={setFilter}
          selected={selected}
          onSelect={setSelected}
          onDraftAll={wb.draftAllEmpties}
          onCarryForward={wb.carryForwardNow}
          onFinaliseAll={wb.bulkFinaliseNow}
        />
        <div className="main">
          {rec ? (
            <RecordView
              db={db}
              record={rec}
              busyName={busyName}
              onDraft={(name, final) => onDraft(selected!, name, final)}
              onPatch={(name, patch) => wb.patch(selected!, name, patch)}
              onNote={(name, value) => wb.setNote(selected!, name, value)}
              onQuick={(name, mode) => wb.quickFill(selected!, name, mode)}
              onReview={(name, state) => wb.review(selected!, name, state)}
              onCarry={(name) => wb.useCarry(selected!, name)}
              onDraftEmpties={() => wb.draftRecordEmpties(selected!)}
              onHarmonise={() => wb.harmonise(selected!)}
              onFinaliseRecord={() => wb.finaliseRecordNow(selected!)}
              onEditCriterion={(c) => {
                setCritPre(c || undefined);
                setModal("library");
              }}
            />
          ) : (
            <div className="empty">
              {!cyc ? (
                <>
                  <div style={{ fontSize: 15 }}>
                    <b>Create a monitoring cycle to begin.</b>
                  </div>
                  <div className="steps">
                    A cycle is one monitoring period (for example 2025 H1). Click the <b>Cycle</b> pill at the top
                    left to create one, then <b>Import records</b> to load the Quality Monitoring Records. Set up
                    your <b>Criterion library</b> once and it applies to every cycle.
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <button className="ai-btn" onClick={wb.loadDemoNow}>
                      Quick start with demo
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 15 }}>
                    <b>No records in “{cyc.name}” yet.</b>
                  </div>
                  <div className="steps">
                    <b>Import records</b> from a CSV export or straight from ERPNext. Or <b>Load demo</b> to try the
                    workflow.
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <button className="ai-btn" onClick={wb.loadDemoNow}>
                      Load demo records
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {modal === "cycles" && (
        <Modal title="Monitoring cycles" onClose={() => setModal(null)}>
          <CycleManager
            db={db}
            onCreate={wb.createCycleNow}
            onSwitch={(id) => {
              wb.switchCycleNow(id);
              setSelected(null);
            }}
            onRename={wb.renameCycleNow}
            onDelete={(id) => {
              wb.deleteCycleNow(id);
              setSelected(null);
            }}
          />
        </Modal>
      )}
      {modal === "library" && (
        <Modal title="Criterion library — GD4 requirement + procedure per criterion" wide onClose={() => setModal(null)}>
          <CriterionLibrary db={db} onSave={wb.saveCriterion} onClearProc={wb.clearProc} onRestoreProc={wb.restoreProc} notify={notify} initialCriterion={critPre} />
        </Modal>
      )}
      {modal === "settings" && (
        <Modal title="Settings" onClose={() => setModal(null)}>
          <SettingsPanel
            settings={db.settings}
            onSave={(p) => {
              wb.saveSettings(p);
              setModal(null);
            }}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
      {modal === "agents" && (
        <Modal title="Agent office" wide onClose={() => setModal(null)}>
          <AgentOffice />
        </Modal>
      )}
      {modal === "erpnext" && (
        <Modal title="ERPNext" onClose={() => setModal(null)}>
          <ErpNextPanel db={db} notify={notify} onImport={wb.erpImport} onWriteBack={wb.erpWriteBack} />
        </Modal>
      )}
      {modal === "import" && (
        <Modal title={"Import records into " + (cyc?.name || "")} onClose={() => setModal(null)}>
          <div style={{ fontSize: 12.5 }}>
            <h4 style={{ color: "var(--navy)", margin: "0 0 6px" }}>From CSV</h4>
            <div className="hint" style={{ marginBottom: 8 }}>
              ERPNext report export of Quality Monitoring Record Item with Parent, ID and the KPI columns.
            </div>
            <button className="act-btn" onClick={() => csvInput.current?.click()}>
              Choose CSV file
            </button>
            <h4 style={{ color: "var(--navy)", margin: "16px 0 6px" }}>From ERPNext API</h4>
            <div className="hint" style={{ marginBottom: 8 }}>Requires URL + token in Settings.</div>
            <button className="act-btn" onClick={() => setModal("erpnext")}>
              Pick from ERPNext
            </button>
            <h4 style={{ color: "var(--navy)", margin: "16px 0 6px" }}>Demo</h4>
            <button
              className="act-btn"
              onClick={() => {
                wb.loadDemoNow();
                setModal(null);
              }}
            >
              Load demo records
            </button>
          </div>
        </Modal>
      )}

      <input
        ref={csvInput}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            const r = new FileReader();
            r.onload = () => {
              wb.importCSVNow(String(r.result));
              setModal(null);
            };
            r.readAsText(f, "utf-8");
          }
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={projInput}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            const r = new FileReader();
            r.onload = () => wb.loadProjectNow(String(r.result));
            r.readAsText(f, "utf-8");
          }
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
