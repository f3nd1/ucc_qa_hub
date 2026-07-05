import type { RunStep } from "@/lib/agents";

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  ok: { bg: "#e8f5e9", fg: "#2e7d32" },
  refused: { bg: "#fff3e0", fg: "#e65100" },
  blocked: { bg: "#fdecea", fg: "#c62828" },
  "no-key": { bg: "#eef2f8", fg: "#1a3b6e" },
  error: { bg: "#fdecea", fg: "#c62828" },
  noop: { bg: "#f0f2f6", fg: "#6b7686" },
};

const DECISION_LABEL: Record<string, string> = {
  accepted: "accepted",
  rejected: "rejected",
  acknowledged: "seen",
};

export function RunStepView({
  step,
  isCurrent,
  onAccept,
  onReject,
  onAcknowledge,
}: {
  step: RunStep;
  isCurrent: boolean;
  onAccept: () => void;
  onReject: () => void;
  onAcknowledge: () => void;
}) {
  const { result, decision } = step;
  const st = STATUS_STYLE[result.status] || STATUS_STYLE.noop;
  const pending = decision === "pending";

  return (
    <div
      style={{
        border: "1px solid var(--border-light)",
        borderLeft: "4px solid " + result.color,
        borderRadius: 6,
        background: "#fff",
        padding: "10px 12px",
        marginBottom: 10,
        opacity: pending || decision === "accepted" ? 1 : 0.85,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: result.color, display: "inline-block" }} />
        <b style={{ color: "var(--navy)", fontSize: 13 }}>{result.agentName}</b>
        <span
          style={{
            fontSize: 10.5,
            borderRadius: 8,
            padding: "1px 8px",
            background: st.bg,
            color: st.fg,
            fontWeight: 600,
          }}
        >
          {result.status}
        </span>
        {!pending && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>
            {DECISION_LABEL[decision] || decision}
          </span>
        )}
      </div>

      <div style={{ fontSize: 12.5, margin: "6px 0" }}>{result.summary}</div>

      {result.refusals.length > 0 && (
        <div
          style={{
            background: "#fff3e0",
            border: "1px solid #ffcc80",
            color: "#e65100",
            borderRadius: 5,
            padding: "7px 10px",
            fontSize: 12.2,
            marginBottom: 6,
          }}
        >
          {result.refusals.map((r, i) => (
            <div key={i} style={{ margin: "2px 0" }}>
              <b>{r.activity}:</b> {r.question}
            </div>
          ))}
        </div>
      )}

      {result.findings.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          {result.findings.map((f, i) => (
            <div key={i} style={{ fontSize: 12.2, margin: "2px 0" }}>
              <span style={{ color: "var(--muted)" }}>{f.activity}</span> —{" "}
              <span
                style={{
                  color:
                    f.flag.level === "error"
                      ? "var(--err)"
                      : f.flag.level === "warn"
                        ? "var(--warn)"
                        : "var(--info)",
                }}
              >
                {f.flag.msg}
              </span>
            </div>
          ))}
        </div>
      )}

      {result.requiresAccept && (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>
          This step proposes changes. Nothing is applied until you accept.
        </div>
      )}

      {isCurrent && pending && (
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {result.requiresAccept ? (
            <>
              <button onClick={onAccept} style={btnPrimary}>
                Accept
              </button>
              <button onClick={onReject} style={btnGhost}>
                Reject
              </button>
            </>
          ) : (
            <button onClick={onAcknowledge} style={btnPrimary}>
              Continue
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  background: "var(--navy)",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  padding: "6px 14px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  background: "#fff",
  color: "var(--navy)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "6px 14px",
  fontSize: 12,
  cursor: "pointer",
};
