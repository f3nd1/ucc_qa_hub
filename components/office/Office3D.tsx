"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useDb } from "@/lib/store/store";
import { activeCycle, emptyFilter, recordOrder, recordPassesFilter, records, rowKey } from "@/lib/qmr-engine";
import type { Filter } from "@/lib/qmr-engine";
import { getAgents } from "@/lib/agents";
import { useWorkbench } from "../useWorkbench";
import type { Notify } from "../useWorkbench";
import { Scene } from "./Scene";
import { Window } from "../windows/Window";
import { AgentOffice } from "../phase2/AgentOffice";
import { RecordCard } from "../phase1/RecordCard";
import { SettingsPanel } from "../phase1/SettingsPanel";
import { AgentPanel } from "./AgentPanel";
import { CriterionLibrary } from "./CriterionLibrary";
import { AgentEditor } from "./AgentEditor";
import { CycleManager } from "./CycleManager";
import { FiltersPanel } from "./FiltersPanel";
import { SignOffPanel } from "./SignOffPanel";

type WinKind = "orchestrator" | "settings" | "library" | "record" | "agent" | "agents-config" | "cycles" | "filters" | "signoff";
interface WinItem {
  id: string;
  kind: WinKind;
  agentId?: string;
}
interface Pos {
  x: number;
  y: number;
  z: number;
}

const TITLES: Record<WinKind, string> = {
  orchestrator: "Orchestrator",
  settings: "Settings",
  library: "Criterion library",
  record: "Record editor",
  agent: "Agent",
  "agents-config": "Configure agents",
  cycles: "Monitoring cycles",
  filters: "Filters",
  signoff: "Sign-off",
};

export function Office3D({ notify, onSetMode }: { notify: Notify; onSetMode: () => void }) {
  const wb = useWorkbench(notify);
  const {
    db,
    loadDemoNow,
    saveSettings,
    clearProc,
    restoreProc,
    patch,
    review,
    draft,
    toggleAgentNow,
    exportFile,
  } = wb;

  const order = recordOrder(db);
  const agents = getAgents(db);

  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [wins, setWins] = useState<WinItem[]>([]);
  const [pos, setPos] = useState<Record<string, Pos>>({});
  const [selectedRecord, setSelectedRecord] = useState<string>("");
  const [busyName, setBusyName] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(emptyFilter());
  const zc = useRef(20);

  const shelfOrder = order.filter((p) => recordPassesFilter(records(db)[p], filter));

  useEffect(() => {
    setMounted(true);
    if (window.matchMedia) setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!selectedRecord && order.length) setSelectedRecord(order[0]);
  }, [order, selectedRecord]);

  function focus(id: string) {
    setPos((p) => (p[id] ? { ...p, [id]: { ...p[id], z: ++zc.current } } : p));
  }
  function openWin(item: WinItem) {
    setWins((prev) => (prev.some((w) => w.id === item.id) ? prev : [...prev, item]));
    setPos((prev) => {
      if (prev[item.id]) return { ...prev, [item.id]: { ...prev[item.id], z: ++zc.current } };
      const n = Object.keys(prev).length;
      return { ...prev, [item.id]: { x: 90 + n * 28, y: 84 + n * 26, z: ++zc.current } };
    });
  }
  function closeWin(id: string) {
    setWins((prev) => prev.filter((w) => w.id !== id));
  }
  function move(id: string, x: number, y: number) {
    setPos((prev) => ({ ...prev, [id]: { ...prev[id], x, y } }));
  }

  function openOrchestrator() {
    openWin({ id: "orchestrator", kind: "orchestrator" });
  }
  function openAgent(id: string) {
    openWin({ id: "agent:" + id, kind: "agent", agentId: id });
  }
  function selectRecord(name: string) {
    setSelectedRecord(name);
    openWin({ id: "record", kind: "record" });
    focus("record");
  }

  async function onDraft(parent: string, name: string) {
    const key = rowKey(parent, name);
    setBusyName(key);
    try {
      await draft(parent, name);
    } finally {
      setBusyName(null);
    }
  }

  function renderContent(w: WinItem) {
    switch (w.kind) {
      case "orchestrator":
        return <AgentOffice />;
      case "settings":
        return <SettingsPanel settings={db.settings} onSave={saveSettings} onClose={() => closeWin("settings")} />;
      case "library":
        return (
          <CriterionLibrary
            db={db}
            onSave={wb.saveCriterion}
            onClearProc={clearProc}
            onRestoreProc={restoreProc}
            notify={notify}
          />
        );
      case "agents-config":
        return (
          <AgentEditor
            db={db}
            onUpdate={wb.updateAgentNow}
            onAdd={wb.addAgentNow}
            onRemove={wb.removeAgentNow}
          />
        );
      case "cycles":
        return (
          <CycleManager
            db={db}
            onCreate={wb.createCycleNow}
            onSwitch={(id) => {
              wb.switchCycleNow(id);
              setSelectedRecord("");
            }}
            onRename={wb.renameCycleNow}
            onDelete={(id) => {
              wb.deleteCycleNow(id);
              setSelectedRecord("");
            }}
          />
        );
      case "filters":
        return (
          <FiltersPanel
            db={db}
            filter={filter}
            onChange={setFilter}
            matchCount={shelfOrder.length}
            totalCount={order.length}
          />
        );
      case "signoff":
        return <SignOffPanel db={db} onBulkFinalise={wb.bulkFinaliseNow} onOpenRecord={selectRecord} />;
      case "agent": {
        const agent = agents.find((a) => a.id === w.agentId);
        if (!agent) return <div>Agent not found.</div>;
        return (
          <AgentPanel
            agent={agent}
            onToggle={() => toggleAgentNow(agent.id)}
            onOpenOrchestrator={openOrchestrator}
          />
        );
      }
      case "record": {
        const rec = records(db)[selectedRecord];
        if (!rec) return <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No record selected.</div>;
        return (
          <RecordCard
            db={db}
            record={rec}
            busyName={busyName}
            onDraft={(name) => onDraft(rec.name, name)}
            onPatch={(name, p) => patch(rec.name, name, p)}
            onReview={(name, state) => review(rec.name, name, state)}
            onClearProc={clearProc}
            onRestoreProc={restoreProc}
          />
        );
      }
    }
  }

  function winTitle(w: WinItem): string {
    if (w.kind === "agent") return agents.find((a) => a.id === w.agentId)?.name || "Agent";
    if (w.kind === "record") return selectedRecord ? "Record — " + selectedRecord : "Record editor";
    return TITLES[w.kind];
  }
  function winAccent(w: WinItem): string | undefined {
    if (w.kind === "agent") return agents.find((a) => a.id === w.agentId)?.color;
    if (w.kind === "orchestrator") return "#24508f";
    return undefined;
  }
  function winWidth(w: WinItem): number {
    if (w.kind === "record" || w.kind === "signoff") return 560;
    if (w.kind === "orchestrator" || w.kind === "agents-config" || w.kind === "filters") return 620;
    return 460;
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
          position: "relative",
          zIndex: 500,
        }}
      >
        <h1 style={{ fontSize: 15, margin: 0, fontWeight: 600, letterSpacing: 0.3 }}>QMR Agent Office</h1>
        <span style={{ fontSize: 11.5, opacity: 0.75 }}>Phase 4</span>
        <button
          onClick={() => openWin({ id: "cycles", kind: "cycles" })}
          style={{
            background: "rgba(255,255,255,.14)",
            border: "1px solid rgba(255,255,255,.3)",
            color: "#fff",
            borderRadius: 14,
            padding: "3px 12px",
            fontSize: 12,
            cursor: "pointer",
          }}
          title="Monitoring cycles"
        >
          Cycle: <b>{activeCycle(db)?.name || "none"}</b> ▾
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={{ ...tbBtn, background: "rgba(255,255,255,.22)" }} onClick={onSetMode}>
            Flat mode
          </button>
          <button style={tbBtn} onClick={loadDemoNow}>
            Load demo
          </button>
          <button style={tbBtn} onClick={openOrchestrator}>
            Orchestrator
          </button>
          <button style={tbBtn} onClick={() => openWin({ id: "filters", kind: "filters" })}>
            Filters{filter.main || filter.sub || filter.department || filter.status || filter.review ? " ●" : ""}
          </button>
          <button style={tbBtn} onClick={() => openWin({ id: "signoff", kind: "signoff" })}>
            Sign-off
          </button>
          <button style={tbBtn} onClick={() => openWin({ id: "library", kind: "library" })}>
            Criterion library
          </button>
          <button style={tbBtn} onClick={() => openWin({ id: "agents-config", kind: "agents-config" })}>
            Configure agents
          </button>
          <button style={tbBtn} onClick={() => exportFile("flat")}>
            Export CSV
          </button>
          <button
            style={{ ...tbBtn, background: "#fff", color: "var(--navy)", fontWeight: 600 }}
            onClick={() => openWin({ id: "settings", kind: "settings" })}
          >
            Settings
          </button>
        </div>
      </div>

      {/* 3D canvas. zIndex:0 makes this its own stacking context so the drei
          Html desk labels (which use very high z-indexes) stay contained below
          the draggable window overlay rather than intercepting its clicks. */}
      <div style={{ position: "relative", flex: 1, minHeight: 0, zIndex: 0 }}>
        {mounted && (
          <Canvas
            frameloop="demand"
            shadows={false}
            dpr={[1, 2]}
            camera={{ position: [0, 6, 13], fov: 45 }}
            style={{ width: "100%", height: "100%" }}
          >
            <Scene
              db={db}
              agents={agents}
              order={shelfOrder}
              reducedMotion={reducedMotion}
              onOpenOrchestrator={openOrchestrator}
              onOpenAgent={openAgent}
              onSelectRecord={selectRecord}
            />
          </Canvas>
        )}

        {order.length === 0 && (
          <div
            style={{
              position: "absolute",
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(255,255,255,.94)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 12.5,
              color: "var(--ink)",
              boxShadow: "0 4px 14px rgba(0,0,0,.12)",
            }}
          >
            Press <b>Load demo</b> to populate the office. Drag to orbit, scroll to zoom, click a desk or the
            dais.
          </div>
        )}
      </div>

      {/* draggable window layer (DOM over the canvas) */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100 }}>
        {wins.map((w) => {
          const p = pos[w.id] || { x: 120, y: 100, z: 20 };
          return (
            <div key={w.id} style={{ pointerEvents: "auto" }}>
              <Window
                title={winTitle(w)}
                accent={winAccent(w)}
                x={p.x}
                y={p.y}
                z={p.z}
                width={winWidth(w)}
                onClose={() => closeWin(w.id)}
                onFocus={() => focus(w.id)}
                onMove={(x, y) => move(w.id, x, y)}
              >
                {renderContent(w)}
              </Window>
            </div>
          );
        })}
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
