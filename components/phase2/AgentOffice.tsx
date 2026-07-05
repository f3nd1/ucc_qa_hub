import { useEffect, useState } from "react";
import { store, useDb } from "@/lib/store/store";
import { recordOrder } from "@/lib/qmr-engine";
import type { Agent } from "@/lib/qmr-engine";
import { getAgents, planNarrative, planRun, runAgent, toggleAgent } from "@/lib/agents";
import type { RunStep, RunTarget } from "@/lib/agents";
import { AgentRoster } from "./AgentRoster";
import { RunStepView } from "./RunStepView";

/**
 * The orchestrator office (flat). Pick a record, optionally give an
 * instruction, plan a run, then step through the specialists. Each step
 * pauses for accept/reject; nothing is applied until you accept.
 */
export function AgentOffice() {
  const db = useDb();
  const order = recordOrder(db);

  const [target, setTarget] = useState<string>("");
  const [instruction, setInstruction] = useState("");
  const [plan, setPlan] = useState<Agent[] | null>(null);
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);

  // Default the target to the first record once demo/records exist.
  useEffect(() => {
    if (!target && order.length) setTarget(order[0]);
  }, [order, target]);

  const runTarget: RunTarget = { scope: "record", recordName: target };

  function resetRun() {
    setPlan(null);
    setSteps([]);
    setStarted(false);
    setDone(false);
  }

  function onPlan() {
    if (!target) return;
    setPlan(planRun(getAgents(db), runTarget, instruction));
    setSteps([]);
    setStarted(false);
    setDone(false);
  }

  async function execute(index: number, p: Agent[]) {
    setRunning(true);
    // Read the freshest Db so accepted changes feed the next specialist.
    const current = store.getState();
    const result = await runAgent(current, p[index], runTarget);
    setSteps((prev) => [...prev, { result, decision: "pending" }]);
    setRunning(false);
  }

  async function onStart() {
    if (!plan || !plan.length) return;
    setSteps([]);
    setStarted(true);
    setDone(false);
    await execute(0, plan);
  }

  async function decide(kind: "accepted" | "rejected" | "acknowledged") {
    if (!plan) return;
    const i = steps.length - 1;
    if (i < 0) return;
    const step = steps[i];
    if (kind === "accepted" && step.result.proposedDb) store.set(step.result.proposedDb);
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, decision: kind } : s)));

    if (i + 1 < plan.length) {
      await execute(i + 1, plan);
    } else {
      setDone(true);
    }
  }

  const pendingIndex = steps.findIndex((s) => s.decision === "pending");
  const awaiting = !running && pendingIndex >= 0;

  return (
    <div>
      <div
        style={{
          border: "1px solid var(--border-light)",
          borderRadius: 8,
          background: "#fff",
          padding: 14,
          marginBottom: 16,
          maxWidth: 820,
        }}
      >
        <h3 style={{ margin: "0 0 4px", color: "var(--navy)", fontSize: 14 }}>Orchestrator</h3>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
          AI recommends, humans decide. The orchestrator plans a run and invokes specialists in order.
          Nothing is applied until you accept it.
        </div>

        {order.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            No records yet. Switch to the Records tab and press Load demo first.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "0 0 240px" }}>
                <label style={labelStyle}>Record</label>
                <select
                  style={inputStyle}
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    resetRun();
                  }}
                >
                  {order.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: "1 1 260px" }}>
                <label style={labelStyle}>Instruction (optional)</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. draft and check — or leave blank for the full pipeline"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                />
              </div>
              <button onClick={onPlan} style={btnGhost} disabled={running}>
                Plan run
              </button>
            </div>

            {plan && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12.5, marginBottom: 8 }}>{planNarrative(plan, runTarget)}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {plan.map((a, i) => (
                    <span key={a.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span
                        style={{ width: 9, height: 9, borderRadius: "50%", background: a.color, display: "inline-block" }}
                      />
                      <span style={{ fontSize: 11.5 }}>{a.name}</span>
                      {i < plan.length - 1 && <span style={{ color: "var(--muted)" }}>→</span>}
                    </span>
                  ))}
                </div>
                {!started && (
                  <button onClick={onStart} style={btnPrimary} disabled={!plan.length}>
                    Start run
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {steps.length > 0 && (
        <div style={{ maxWidth: 820, marginBottom: 16 }}>
          {steps.map((s, i) => (
            <RunStepView
              key={i}
              step={s}
              isCurrent={i === pendingIndex}
              onAccept={() => decide("accepted")}
              onReject={() => decide("rejected")}
              onAcknowledge={() => decide("acknowledged")}
            />
          ))}
          {running && <div style={{ fontSize: 12, color: "var(--muted)" }}>Running…</div>}
          {done && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
              <span style={{ fontSize: 12.5, color: "var(--ok)", fontWeight: 600 }}>Run complete.</span>
              <button onClick={resetRun} style={btnGhost}>
                New run
              </button>
            </div>
          )}
          {!done && !running && !awaiting && started && (
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Waiting…</div>
          )}
        </div>
      )}

      <div style={{ maxWidth: 900 }}>
        <AgentRoster db={db} onToggle={(id) => store.set(toggleAgent(db, id))} />
      </div>
    </div>
  );
}

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
const btnPrimary: React.CSSProperties = {
  background: "var(--navy)",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  padding: "7px 14px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  background: "#fff",
  color: "var(--navy)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "7px 14px",
  fontSize: 12,
  cursor: "pointer",
};
