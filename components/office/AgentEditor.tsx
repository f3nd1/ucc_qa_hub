import { useState } from "react";
import type { Agent, AgentScope, Db } from "@/lib/qmr-engine";
import { uid } from "@/lib/qmr-engine";
import { AGENT_KINDS, getAgents, kindOf, nextDeskPosition } from "@/lib/agents";

const SCOPES: AgentScope[] = ["activity", "record", "cycle"];

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

/** Add / remove / edit agents. Editing an agent updates its desk live; adding
    one adds a desk; removing one removes the desk. Config persists in db.agents. */
export function AgentEditor({
  db,
  onUpdate,
  onAdd,
  onRemove,
}: {
  db: Db;
  onUpdate: (id: string, patch: Partial<Agent>) => void;
  onAdd: (agent: Agent) => void;
  onRemove: (id: string, name: string) => void;
}) {
  const agents = getAgents(db);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<string>(AGENT_KINDS[0]);
  const [newColor, setNewColor] = useState("#3f7fd6");
  const [newScope, setNewScope] = useState<AgentScope>("record");

  function addNew() {
    const name = newName.trim();
    if (!name) return;
    const agent: Agent = {
      id: uid(),
      kind: newKind,
      name,
      role: "Custom agent reusing the " + newKind + " behaviour.",
      systemPrompt: "You are " + name + ", a custom specialist reusing the " + newKind + " behaviour.",
      color: newColor,
      deskPosition: nextDeskPosition(agents),
      enabled: true,
      scope: newScope,
    };
    onAdd(agent);
    setNewName("");
  }

  return (
    <div style={{ fontSize: 12.5 }}>
      <div style={{ color: "var(--muted)", marginBottom: 10 }}>
        Agents are configuration. Edit a field to update its desk; add one to place a new desk; remove one to
        clear its desk. The orchestrator is fixed.
      </div>

      {agents.map((a) => {
        const isOrch = a.id === "orchestrator";
        return (
          <div
            key={a.id}
            style={{ border: "1px solid var(--border-light)", borderRadius: 6, padding: 10, marginBottom: 10 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <input
                type="color"
                value={a.color}
                onChange={(e) => onUpdate(a.id, { color: e.target.value })}
                style={{ width: 26, height: 26, border: "none", background: "none", cursor: "pointer" }}
                aria-label="Desk light colour"
              />
              <input
                value={a.name}
                onChange={(e) => onUpdate(a.id, { name: e.target.value })}
                style={{ ...input, fontWeight: 600, flex: 1 }}
              />
              {!isOrch && (
                <button
                  onClick={() => onRemove(a.id, a.name)}
                  style={{
                    border: "1px solid #e0b4b0",
                    background: "#fff",
                    color: "var(--err)",
                    borderRadius: 4,
                    padding: "4px 8px",
                    fontSize: 11.5,
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              {!isOrch && (
                <div style={{ flex: "0 0 130px" }}>
                  <label style={label}>Behaviour (kind)</label>
                  <select value={kindOf(a)} onChange={(e) => onUpdate(a.id, { kind: e.target.value })} style={input}>
                    {AGENT_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ flex: "0 0 120px" }}>
                <label style={label}>Scope</label>
                <select value={a.scope} onChange={(e) => onUpdate(a.id, { scope: e.target.value as AgentScope })} style={input}>
                  {SCOPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: "0 0 70px" }}>
                <label style={label}>Desk X</label>
                <input
                  style={{ ...input, fontFamily: "var(--mono)" }}
                  value={a.deskPosition[0]}
                  onChange={(e) =>
                    onUpdate(a.id, { deskPosition: [Number(e.target.value) || 0, 0, a.deskPosition[2]] })
                  }
                />
              </div>
              <div style={{ flex: "0 0 70px" }}>
                <label style={label}>Desk Z</label>
                <input
                  style={{ ...input, fontFamily: "var(--mono)" }}
                  value={a.deskPosition[2]}
                  onChange={(e) =>
                    onUpdate(a.id, { deskPosition: [a.deskPosition[0], 0, Number(e.target.value) || 0] })
                  }
                />
              </div>
              {!isOrch && (
                <div style={{ flex: "0 0 auto", alignSelf: "flex-end", paddingBottom: 5 }}>
                  <label style={{ fontSize: 11.5, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={a.enabled}
                      onChange={(e) => onUpdate(a.id, { enabled: e.target.checked })}
                      style={{ marginRight: 5 }}
                    />
                    Enabled
                  </label>
                </div>
              )}
            </div>

            <label style={label}>Role (shown at the desk)</label>
            <input value={a.role} onChange={(e) => onUpdate(a.id, { role: e.target.value })} style={{ ...input, marginBottom: 8 }} />

            <label style={label}>Grounding brief (system prompt)</label>
            <textarea
              value={a.systemPrompt}
              onChange={(e) => onUpdate(a.id, { systemPrompt: e.target.value })}
              style={{ ...input, minHeight: 54, resize: "vertical", lineHeight: 1.4 }}
            />
          </div>
        );
      })}

      <div style={{ border: "1px dashed var(--border)", borderRadius: 6, padding: 10, background: "#fafbfd" }}>
        <div style={{ fontWeight: 600, color: "var(--navy)", marginBottom: 8 }}>Add an agent (adds a desk)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 160px" }}>
            <label style={label}>Name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} style={input} placeholder="e.g. Evidence Checker" />
          </div>
          <div style={{ flex: "0 0 130px" }}>
            <label style={label}>Behaviour</label>
            <select value={newKind} onChange={(e) => setNewKind(e.target.value)} style={input}>
              {AGENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "0 0 110px" }}>
            <label style={label}>Scope</label>
            <select value={newScope} onChange={(e) => setNewScope(e.target.value as AgentScope)} style={input}>
              {SCOPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            style={{ width: 30, height: 30, border: "none", background: "none", cursor: "pointer" }}
            aria-label="New desk colour"
          />
          <button
            onClick={addNew}
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
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
