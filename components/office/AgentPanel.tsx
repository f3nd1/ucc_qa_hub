import type { Agent } from "@/lib/qmr-engine";

/** The panel that opens when you click an agent's desk. */
export function AgentPanel({
  agent,
  onToggle,
  onOpenOrchestrator,
}: {
  agent: Agent;
  onToggle?: () => void;
  onOpenOrchestrator: () => void;
}) {
  const isOrchestrator = agent.id === "orchestrator";
  return (
    <div style={{ fontSize: 12.5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: agent.color, display: "inline-block" }} />
        <b style={{ color: "var(--navy)", fontSize: 14 }}>{agent.name}</b>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>operates on: {agent.scope}</span>
      </div>

      <div style={{ color: "var(--ink)", marginBottom: 10, lineHeight: 1.5 }}>{agent.role}</div>

      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginBottom: 3 }}>Grounding brief</div>
      <div
        style={{
          background: "var(--navy-soft)",
          border: "1px solid var(--border-light)",
          borderRadius: 5,
          padding: "8px 10px",
          fontSize: 11.8,
          lineHeight: 1.5,
          color: "#35455c",
          marginBottom: 12,
        }}
      >
        {agent.systemPrompt}
      </div>

      {isOrchestrator ? (
        <button onClick={onOpenOrchestrator} style={btn}>
          Open orchestrator
        </button>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={agent.enabled} onChange={onToggle} style={{ marginRight: 6 }} />
            Enabled (disabling dims its desk)
          </label>
          <button onClick={onOpenOrchestrator} style={btnGhost}>
            Run from orchestrator
          </button>
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "var(--navy)",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  padding: "7px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  background: "#fff",
  color: "var(--navy)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "6px 12px",
  fontSize: 12,
  cursor: "pointer",
};
