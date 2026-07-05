import type { CheckFlag, Item, ReviewState } from "@/lib/qmr-engine";
import { detectPattern, num } from "@/lib/qmr-engine";
import { CheckList } from "./CheckList";

const REVIEW_STATES: ReviewState[] = ["Draft", "Under Review", "Final"];
const PATTERN_LABEL: Record<string, string> = {
  met: "met target",
  nil: "nil period",
  short: "shortfall",
};

const boxStyle: React.CSSProperties = {
  border: "1px solid var(--border-light)",
  borderRadius: 6,
  background: "var(--card)",
  marginBottom: 12,
};
const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 500,
  fontSize: 11.5,
  color: "var(--navy)",
  marginBottom: 3,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "6px 7px",
  fontSize: 12.5,
  background: "#fff",
  fontFamily: "inherit",
};

export function ActivityCard({
  item,
  flags,
  busy,
  onDraft,
  onPatch,
  onReview,
}: {
  item: Item;
  flags: CheckFlag[];
  busy: boolean;
  onDraft: () => void;
  onPatch: (patch: Partial<Item>) => void;
  onReview: (state: ReviewState) => void;
}) {
  const pattern = detectPattern(item);

  return (
    <div style={boxStyle}>
      <div
        style={{
          padding: "8px 12px",
          fontWeight: 600,
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#f5f7fa",
          color: "var(--navy)",
          borderRadius: "6px 6px 0 0",
          flexWrap: "wrap",
        }}
      >
        <span>{item.activity_name || item.name}</span>
        <span
          style={{
            fontSize: 10.5,
            borderRadius: 8,
            padding: "1px 8px",
            background: "var(--navy-soft)",
            color: "var(--navy)",
          }}
        >
          {PATTERN_LABEL[pattern]}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "var(--mono)",
            fontSize: 11.5,
            fontWeight: 600,
            background: "rgba(255,255,255,.7)",
            border: "1px solid rgba(0,0,0,.08)",
            borderRadius: 8,
            padding: "1px 8px",
          }}
        >
          {item.kpi_actual_value == null ? "—" : item.kpi_actual_value}
          {item.uom} / {item.kpi_target_value == null ? "—" : item.kpi_target_value}
          {item.uom}
        </span>
        <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{item.review_state}</span>
      </div>

      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
          {item.kpi_metric}
          {item.kpi_target_desc ? " — " + item.kpi_target_desc : ""}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ flex: "0 0 130px" }}>
            <label style={labelStyle}>KPI actual value</label>
            <input
              style={{ ...inputStyle, fontFamily: "var(--mono)" }}
              inputMode="decimal"
              value={item.kpi_actual_value ?? ""}
              onChange={(e) => onPatch({ kpi_actual_value: num(e.target.value) })}
            />
          </div>
          <div style={{ flex: "1 1 240px" }}>
            <label style={labelStyle}>Note (what happened)</label>
            <textarea
              style={{ ...inputStyle, minHeight: 46, resize: "vertical" }}
              value={item._note}
              onChange={(e) => onPatch({ _note: e.target.value })}
            />
          </div>
          <div style={{ flex: "1 1 240px" }}>
            <label style={labelStyle}>Evidence</label>
            <textarea
              style={{ ...inputStyle, minHeight: 46, resize: "vertical" }}
              value={item.evidence_text}
              onChange={(e) => onPatch({ evidence_text: e.target.value })}
            />
          </div>
        </div>

        <button
          onClick={onDraft}
          disabled={busy}
          style={{
            background: "var(--navy)",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            padding: "7px 12px",
            fontSize: 12,
            fontWeight: 600,
            opacity: busy ? 0.55 : 1,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "Drafting…" : "Draft this activity"}
        </button>

        {item._refusal ? (
          <div
            style={{
              background: "#fff3e0",
              border: "1px solid #ffcc80",
              color: "#e65100",
              borderRadius: 5,
              padding: "8px 10px",
              marginTop: 8,
              fontSize: 12.3,
            }}
          >
            <b style={{ display: "block", marginBottom: 2 }}>Refused — needs input</b>
            {item._refusal.question}
            {item._refusal.missing.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 11.5 }}>
                Missing: {item._refusal.missing.join("; ")}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <div style={{ flex: "1 1 320px" }}>
              <label style={labelStyle}>Evaluation Text</label>
              <textarea
                style={{ ...inputStyle, minHeight: 70, resize: "vertical", lineHeight: 1.45 }}
                value={item.evaluation_text}
                onChange={(e) => onPatch({ evaluation_text: e.target.value })}
              />
            </div>
            <div style={{ flex: "1 1 320px" }}>
              <label style={labelStyle}>Improvement Action</label>
              <textarea
                style={{ ...inputStyle, minHeight: 70, resize: "vertical", lineHeight: 1.45 }}
                value={item.improvement_action}
                onChange={(e) => onPatch({ improvement_action: e.target.value })}
              />
            </div>
          </div>
        )}

        {item._critique && (item._critique.assumptions || item._critique.weakest || item._critique.fixed) && (
          <div
            style={{
              background: "#f3f0fa",
              border: "1px solid #d6cbec",
              color: "#4a3b6b",
              borderRadius: 5,
              padding: "7px 10px",
              marginTop: 8,
              fontSize: 11.8,
              lineHeight: 1.5,
            }}
          >
            {item._critique.assumptions && (
              <div>
                <b style={{ color: "#5e35b1" }}>Assumed:</b> {item._critique.assumptions}
              </div>
            )}
            {item._critique.weakest && (
              <div>
                <b style={{ color: "#5e35b1" }}>Weakest point:</b> {item._critique.weakest}
              </div>
            )}
            {item._critique.fixed && (
              <div>
                <b style={{ color: "#5e35b1" }}>Self-check:</b> {item._critique.fixed}
              </div>
            )}
            {item._critique.model && (
              <div style={{ color: "var(--muted)", fontSize: 10.5, marginTop: 3 }}>
                model: {item._critique.model}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <CheckList flags={flags} />
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px dashed #e0e5ec",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Review:</span>
          {REVIEW_STATES.map((st) => {
            const on = (item.review_state || "Draft") === st;
            return (
              <button
                key={st}
                onClick={() => onReview(st)}
                style={{
                  border: "1px solid var(--border)",
                  background: on ? "var(--navy-soft)" : "#fff",
                  borderRadius: 4,
                  padding: "4px 10px",
                  fontSize: 11.5,
                  fontWeight: on ? 600 : 400,
                  color: on ? "var(--navy)" : "var(--ink)",
                  cursor: "pointer",
                }}
              >
                {st}
              </button>
            );
          })}
          {item.reviewed_by && (
            <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>
              Signed off by {item.reviewed_by} on {item.reviewed_on}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
