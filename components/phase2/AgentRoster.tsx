import type { Db } from "@/lib/qmr-engine";
import { getAgents } from "@/lib/agents";

/** The specialist desks in flat form: colour, role, scope, enable toggle.
    (Disabling one dims its desk in the 3D office in a later phase.) */
export function AgentRoster({ db, onToggle }: { db: Db; onToggle: (id: string) => void }) {
  const agents = getAgents(db);

  return (
    <div>
      <h3 style={{ color: "var(--navy)", fontSize: 13, margin: "0 0 8px" }}>Agents</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
        {agents.map((a) => {
          const isOrchestrator = a.id === "orchestrator";
          return (
            <div
              key={a.id}
              style={{
                border: "1px solid var(--border-light)",
                borderRadius: 6,
                padding: "9px 11px",
                background: a.enabled ? "#fff" : "#f7f8fa",
                opacity: a.enabled ? 1 : 0.6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{ width: 11, height: 11, borderRadius: "50%", background: a.color, display: "inline-block" }}
                />
                <b style={{ fontSize: 12.5, color: "var(--navy)" }}>{a.name}</b>
                <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--muted)" }}>{a.scope}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", margin: "5px 0 7px", lineHeight: 1.4 }}>
                {a.role}
              </div>
              {isOrchestrator ? (
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Always on (you talk to it)</span>
              ) : (
                <label style={{ fontSize: 11.5, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={a.enabled}
                    onChange={() => onToggle(a.id)}
                    style={{ marginRight: 6 }}
                  />
                  Enabled
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
