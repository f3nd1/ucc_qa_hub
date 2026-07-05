import { useState } from "react";
import type { CheckFlag, Db, Item, QmrRecord, ReviewState } from "@/lib/qmr-engine";
import { getProcedure, getRequirement, recChecks, rowChecks, rowKey } from "@/lib/qmr-engine";
import type { QuickMode } from "@/lib/qmr-engine";
import { FullActivityCard } from "./FullActivityCard";

export function RecordView({
  db,
  record,
  busyName,
  onDraft,
  onPatch,
  onNote,
  onQuick,
  onReview,
  onCarry,
  onDraftEmpties,
  onHarmonise,
  onFinaliseRecord,
  onEditCriterion,
}: {
  db: Db;
  record: QmrRecord;
  busyName: string | null;
  onDraft: (name: string, final: boolean) => void;
  onPatch: (name: string, patch: Partial<Item>) => void;
  onNote: (name: string, value: string) => void;
  onQuick: (name: string, mode: QuickMode) => void;
  onReview: (name: string, state: ReviewState) => void;
  onCarry: (name: string) => void;
  onDraftEmpties: () => void;
  onHarmonise: () => void;
  onFinaliseRecord: () => void;
  onEditCriterion: (criterion: string) => void;
}) {
  const rec = record;
  const hasProc = !!getProcedure(db, rec.criterion);
  const hasReq = !!getRequirement(db, rec.criterion);
  const [expanded, setExpanded] = useState(false);

  const recFlags = recChecks(rec);
  const allRowFlags: Array<CheckFlag & { act: string }> = [];
  rec.items.forEach((r, i) => rowChecks(db, rec, r).forEach((f) => allRowFlags.push({ ...f, act: "#" + (i + 1) + " " + (r.activity_name || r.name) })));
  const serious = allRowFlags.filter((f) => f.level !== "info").length + recFlags.length;

  return (
    <div>
      <div className="rec-head">
        <h2>{rec.name}</h2>
        <span className="meta">
          {rec.department} · {rec.criterion} · {rec.period_from} to {rec.period_to}
        </span>
        <span className="spacer">
          <button className="act-btn" onClick={onDraftEmpties}>
            AI draft empty in this record
          </button>
          <button className="act-btn" onClick={onHarmonise}>
            Harmonise voice
          </button>
          <button className="act-btn" onClick={onFinaliseRecord}>
            Reviewed → final (this record)
          </button>
        </span>
      </div>

      <div className={"proc-banner " + (hasProc ? "proc-present" : "proc-missing")}>
        {hasProc
          ? "✓ Procedure loaded for " +
            rec.criterion +
            ". " +
            (hasReq
              ? "GD4 requirement loaded too — drafts will be audit-aligned."
              : "No GD4 requirement yet — add it for stronger audit alignment.")
          : "⚠ No procedure loaded for " +
            (rec.criterion || "this criterion") +
            ". AI drafting is blocked until you add the SOP so drafts stay grounded."}
        <span className="spc" />
        <button onClick={() => onEditCriterion(rec.criterion || "")}>{hasProc ? "Edit criterion" : "Add SOP"}</button>
      </div>

      <div className="check-rail">
        <div className="cr-head" onClick={() => setExpanded((v) => !v)}>
          {serious ? (
            <span className="cr-bad">⚠ {serious} check{serious > 1 ? "s" : ""} need attention</span>
          ) : (
            <span className="cr-ok">✓ All checks pass for this record</span>
          )}
          <span style={{ marginLeft: "auto", color: "var(--muted)", fontWeight: 400, fontSize: 11.5 }}>
            click to expand
          </span>
        </div>
        {expanded && (
          <div>
            <ul>
              {recFlags.map((f, i) => (
                <li key={"r" + i} className={"lv-" + f.level}>
                  [record] {f.msg}
                </li>
              ))}
              {allRowFlags.map((f, i) => (
                <li key={"a" + i} className={"lv-" + f.level}>
                  [{f.act}] {f.msg}
                </li>
              ))}
              {recFlags.length + allRowFlags.length === 0 && <li className="lv-info">Nothing flagged.</li>}
            </ul>
          </div>
        )}
      </div>

      {rec.items.map((row, i) => (
        <FullActivityCard
          key={row.name}
          item={row}
          index={i}
          flags={rowChecks(db, rec, row)}
          busy={busyName === rowKey(rec.name, row.name)}
          onPatch={(patch) => onPatch(row.name, patch)}
          onNote={(value) => onNote(row.name, value)}
          onQuick={(mode) => onQuick(row.name, mode)}
          onDraft={(final) => onDraft(row.name, final)}
          onReview={(state) => onReview(row.name, state)}
          onCarry={() => onCarry(row.name)}
        />
      ))}
    </div>
  );
}
