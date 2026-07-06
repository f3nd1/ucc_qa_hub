import type { CheckFlag, Item, ReviewState } from "@/lib/qmr-engine";
import { num } from "@/lib/qmr-engine";
import type { QuickMode } from "@/lib/qmr-engine";

const STATUSES = ["Planned", "In Progress", "Completed", "Deferred"];

function statusClass(st: string): string {
  return st === "Planned"
    ? "h-planned"
    : st === "In Progress"
      ? "h-progress"
      : st === "Completed"
        ? "h-done"
        : st === "Deferred"
          ? "h-deferred"
          : "";
}

/** One activity card, a faithful port of the original workbench card. */
export function FullActivityCard({
  item,
  index,
  flags,
  busy,
  onPatch,
  onNote,
  onQuick,
  onDraft,
  onReview,
  onCarry,
}: {
  item: Item;
  index: number;
  flags: CheckFlag[];
  busy: boolean;
  onPatch: (patch: Partial<Item>) => void;
  onNote: (value: string) => void;
  onQuick: (mode: QuickMode) => void;
  onDraft: () => void;
  onReview: (state: ReviewState) => void;
  onCarry: () => void;
}) {
  const row = item;
  const t = row.kpi_target_value;
  const a = row.kpi_actual_value;
  const chip = (a === null ? "—" : a) + " / " + (t === null ? "—" : t) + (row.uom ? " " + row.uom : "");
  const rs = row.review_state || "Draft";
  const revChip =
    rs === "Final" ? (
      <span className="rev-chip rc-final">Final</span>
    ) : rs === "Under Review" ? (
      <span className="rev-chip rc-review">Under review</span>
    ) : (
      <span className="rev-chip rc-draft">Draft</span>
    );

  // Editing the narrative clears the refusal/critique and drops Final to Under Review.
  const editNarrative = (patch: Partial<Item>) =>
    onPatch({ ...patch, _refusal: null, _critique: null, review_state: rs === "Final" ? "Under Review" : rs });

  return (
    <div className="qmr-card">
      <div className={"qmr-header " + statusClass(String(row.action_status))}>
        #{index + 1}. {row.activity_name || "Untitled activity"}
        {revChip}
        <span className="kpi-chip">{chip}</span>
      </div>
      <div className="qmr-body">
        <div className="ctx">
          <div>
            <div className="cl">KPI Metric</div>
            <div className="cv">{row.kpi_metric}</div>
          </div>
          <div>
            <div className="cl">Feedback Source</div>
            <div className="cv">{row.feedback_source}</div>
          </div>
          <div>
            <div className="cl">Ownership</div>
            <div className="cv">{row.ownership}</div>
          </div>
          <div>
            <div className="cl">Frequency / Timing</div>
            <div className="cv">
              {row.frequency} · {row.timing}
            </div>
          </div>
        </div>

        <div className="target-desc">{row.kpi_target_desc || "No target description."}</div>

        {row._carry && (row._carry.evaluation_text || row._carry.improvement_action) && (
          <div className="carry-note">
            <b>Prior cycle:</b> {(row._carry.evaluation_text || "").slice(0, 220)}
            {row._carry.evaluation_text && row._carry.evaluation_text.length > 220 ? "…" : ""}{" "}
            <button className="qf-btn" style={{ marginLeft: 6 }} onClick={onCarry}>
              Use as starting point
            </button>
          </div>
        )}

        <div className="edit-grid">
          <div className="fld">
            <label>KPI Actual Value</label>
            <input
              type="number"
              step="any"
              className={"in num" + (a === null ? " missing" : "")}
              value={a === null ? "" : a}
              onChange={(e) => onPatch({ kpi_actual_value: num(e.target.value) })}
            />
          </div>
          <div className="fld">
            <label>Target</label>
            <input className="in num" value={t === null ? "" : t} readOnly />
          </div>
          <div className="fld">
            <label>UOM</label>
            <input className="in" value={row.uom} readOnly />
          </div>
          <div className="fld">
            <label>Action Status</label>
            <select className="in" value={String(row.action_status)} onChange={(e) => onPatch({ action_status: e.target.value })}>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="txt-row">
          <div className="fld">
            <label>⭐ Evaluation Text</label>
            <textarea
              className={"in" + (String(row.evaluation_text || "").trim() ? "" : " missing")}
              placeholder="What happened this period, grounded in the procedure and the numbers…"
              value={row.evaluation_text}
              onChange={(e) => editNarrative({ evaluation_text: e.target.value })}
            />
          </div>
          <div className="fld">
            <label>🛠 Improvement Action</label>
            <textarea
              className={"in" + (String(row.improvement_action || "").trim() ? "" : " missing")}
              placeholder="Maintain… or a Quality Action if below target…"
              value={row.improvement_action}
              onChange={(e) => editNarrative({ improvement_action: e.target.value })}
            />
          </div>
        </div>

        <div className="qf-row">
          <span className="qf-label">Quick fill (no AI):</span>
          <button
            className="qf-btn"
            title="Fills in a ready-made sentence for a fully met target. No AI call — edit it to match what actually happened."
            onClick={() => onQuick("met")}
          >
            Met target
          </button>
          <button
            className="qf-btn"
            title="Fills in the standard nil-activity wording for a period where nothing happened. No AI call."
            onClick={() => onQuick("nil")}
          >
            Nil period
          </button>
          <button
            className="qf-btn"
            title="Fills in a template that acknowledges a below-target shortfall and asks for a Quality Action. No AI call."
            onClick={() => onQuick("short")}
          >
            Shortfall
          </button>
        </div>

        <div className="ai-row">
          <div className="fld">
            <label>Evidence (paste from ERPNext / logs — grounds the AI)</label>
            <textarea
              className="in"
              style={{ minHeight: 44 }}
              placeholder="e.g. QA-2025-014 closed 12 Mar; Aug quality meeting minutes item 4…"
              value={row.evidence_text || ""}
              onChange={(e) => onPatch({ evidence_text: e.target.value })}
            />
          </div>
          <div className="fld">
            <label>Note / cause (what actually happened) — saved to note bank</label>
            <input
              className="in"
              placeholder="e.g. no cases this period / 2 of 4 done, delayed by X"
              value={row._note || ""}
              onChange={(e) => onNote(e.target.value)}
            />
          </div>
          <button
            className="ai-btn"
            disabled={busy}
            title="Asks the AI to write the Evaluation Text and Improvement Action for this activity. It refuses and asks a question if it doesn't have enough to go on."
            onClick={onDraft}
          >
            {busy ? "Drafting…" : "Draft"}
          </button>
        </div>

        {row._refusal && (
          <div className="ai-refusal">
            <b>ℹ AI needs more input before it can draft this:</b>
            {row._refusal.question}
            {row._refusal.missing && row._refusal.missing.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 11.5 }}>Missing: {row._refusal.missing.join("; ")}</div>
            )}
          </div>
        )}

        {row._critique && (row._critique.assumptions || row._critique.weakest || row._critique.fixed) && (
          <div className="ai-critique">
            {row._critique.assumptions && (
              <div>
                <b>Assumed:</b> {row._critique.assumptions}
              </div>
            )}
            {row._critique.weakest && (
              <div>
                <b>Auditor may challenge:</b> {row._critique.weakest}
              </div>
            )}
            {row._critique.fixed && (
              <div>
                <b>Self-check fixed:</b> {row._critique.fixed}
              </div>
            )}
            {row._critique.model && <div className="crit-model">drafted with {row._critique.model}</div>}
          </div>
        )}

        <div className="review-row">
          <span className="rlabel">Review:</span>
          <button className="rev-set" onClick={() => onReview("Draft")}>
            Draft
          </button>
          <button className={"rev-set" + (rs === "Under Review" ? " on-review" : "")} onClick={() => onReview("Under Review")}>
            Under review
          </button>
          <button className={"rev-set" + (rs === "Final" ? " on-final" : "")} onClick={() => onReview("Final")}>
            Final
          </button>
          {rs === "Final" && row.reviewed_by && (
            <span className="rlabel" style={{ marginLeft: 6 }}>
              signed off by {row.reviewed_by} on {row.reviewed_on}
            </span>
          )}
        </div>

        {flags.length > 0 && (
          <div className="row-flags">
            {flags.map((f, i) => (
              <div key={i} className={"rf lv-" + f.level}>
                {f.level === "error" ? "✖" : f.level === "warn" ? "⚠" : "ℹ"} {f.msg}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
