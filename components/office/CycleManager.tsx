import { useState } from "react";
import type { Db } from "@/lib/qmr-engine";

const label: React.CSSProperties = { fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 2 };
const input: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "5px 6px",
  fontSize: 12,
  background: "#fff",
  fontFamily: "inherit",
};

/** Monitoring cycles: switch, create (with carry-forward), rename, delete.
    Carry-forward seeds a new cycle from a prior one, resetting actuals. */
export function CycleManager({
  db,
  onCreate,
  onSwitch,
  onRename,
  onDelete,
}: {
  db: Db;
  onCreate: (name: string, from: string, to: string, seedId: string | null) => void;
  onSwitch: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const cycles = Object.values(db.cycles);
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [seed, setSeed] = useState<string>("");

  function create() {
    if (!name.trim()) return;
    onCreate(name.trim(), from, to, seed || null);
    setName("");
    setFrom("");
    setTo("");
    setSeed("");
  }

  return (
    <div style={{ fontSize: 12.5 }}>
      <div style={{ color: "var(--muted)", marginBottom: 10 }}>
        Each cycle is a saved set of records for a period. Switching swaps the whole workspace. Carry-forward
        seeds a new cycle from a previous one, copying records and last cycle&apos;s narratives while resetting
        actuals and review state.
      </div>

      {cycles.length === 0 && <div style={{ color: "var(--muted)", marginBottom: 10 }}>No cycles yet. Load the demo or create one.</div>}

      {cycles.map((c) => {
        const active = db.activeCycle === c.id;
        const recCount = Object.keys(c.records).length;
        return (
          <div
            key={c.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              border: "1px solid var(--border-light)",
              borderRadius: 6,
              marginBottom: 6,
              background: active ? "var(--navy-soft)" : "#fff",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: "var(--navy)" }}>
                {c.name} {active && <span style={{ fontSize: 10.5, color: "var(--ok)" }}>· active</span>}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                {recCount} record(s){c.period_from ? " · " + c.period_from + " to " + c.period_to : ""}
              </div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
              {!active && (
                <button style={mini} onClick={() => onSwitch(c.id)}>
                  Switch
                </button>
              )}
              <button
                style={mini}
                onClick={() => {
                  const n = window.prompt("Rename cycle:", c.name);
                  if (n !== null && n.trim()) onRename(c.id, n.trim());
                }}
              >
                Rename
              </button>
              <button
                style={{ ...mini, color: "var(--err)", borderColor: "#e0b4b0" }}
                onClick={() => {
                  if (window.confirm('Delete cycle "' + c.name + '" and all its records? This cannot be undone.'))
                    onDelete(c.id);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}

      <div style={{ border: "1px dashed var(--border)", borderRadius: 6, padding: 10, background: "#fafbfd", marginTop: 10 }}>
        <div style={{ fontWeight: 600, color: "var(--navy)", marginBottom: 8 }}>New cycle</div>
        <div style={{ marginBottom: 8 }}>
          <label style={label}>Cycle name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={input} placeholder="e.g. 2026 H1" />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ flex: "1 1 130px" }}>
            <label style={label}>Period from</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={input} />
          </div>
          <div style={{ flex: "1 1 130px" }}>
            <label style={label}>Period to</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={input} />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={label}>Carry forward from (optional)</label>
          <select value={seed} onChange={(e) => setSeed(e.target.value)} style={input}>
            <option value="">Start empty</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={create}
          style={{
            background: "var(--navy)",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Create cycle
        </button>
      </div>
    </div>
  );
}

const mini: React.CSSProperties = {
  border: "1px solid var(--border)",
  background: "#fff",
  color: "var(--navy)",
  borderRadius: 4,
  padding: "3px 8px",
  fontSize: 11.5,
  cursor: "pointer",
};
