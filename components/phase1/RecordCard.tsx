import type { Db, QmrRecord, ReviewState, Item } from "@/lib/qmr-engine";
import { criterionReady, DEMO_PROC, recChecks, rowChecks } from "@/lib/qmr-engine";
import { ActivityCard } from "./ActivityCard";
import { CheckList } from "./CheckList";

/** One Quality Monitoring Record: header, grounding banner, activities. */
export function RecordCard({
  db,
  record,
  busyName,
  onDraft,
  onPatch,
  onReview,
  onClearProc,
  onRestoreProc,
}: {
  db: Db;
  record: QmrRecord;
  busyName: string | null;
  onDraft: (childName: string) => void;
  onPatch: (childName: string, patch: Partial<Item>) => void;
  onReview: (childName: string, state: ReviewState) => void;
  onClearProc: (criterion: string) => void;
  onRestoreProc: (criterion: string) => void;
}) {
  const hasProc = criterionReady(db, record.criterion);
  const canRestore = !!DEMO_PROC[record.criterion];
  const recFlags = recChecks(record);

  return (
    <section style={{ marginBottom: 22 }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--border-light)",
          borderRadius: 6,
          padding: "12px 14px",
          marginBottom: 10,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 15, color: "var(--navy)" }}>{record.name}</h2>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>
          {record.department} · {record.criterion}
        </span>
      </div>

      {/* Grounding banner: the visible state of the refuse rule. */}
      <div
        style={{
          borderRadius: 6,
          padding: "8px 12px",
          marginBottom: 10,
          fontSize: 12.3,
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: hasProc ? "#e8f5e9" : "#fff3e0",
          border: "1px solid " + (hasProc ? "#a5d6a7" : "#ffcc80"),
          color: hasProc ? "#2e7d32" : "#e65100",
        }}
      >
        <span>
          {hasProc
            ? "Procedure loaded for " + record.criterion + " — grounded drafting is allowed."
            : "No procedure loaded for " + record.criterion + " — drafting will refuse (client-side gate)."}
        </span>
        <span style={{ marginLeft: "auto" }} />
        {hasProc ? (
          <button
            onClick={() => onClearProc(record.criterion)}
            style={bannerBtn}
            title="Clear the procedure to prove the refuse rule with no API key"
          >
            Clear procedure
          </button>
        ) : (
          canRestore && (
            <button onClick={() => onRestoreProc(record.criterion)} style={bannerBtn}>
              Restore demo procedure
            </button>
          )
        )}
      </div>

      {recFlags.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <CheckList flags={recFlags} />
        </div>
      )}

      {record.items.map((it) => (
        <ActivityCard
          key={it.name}
          item={it}
          flags={rowChecks(db, record, it)}
          busy={busyName === record.name + "||" + it.name}
          onDraft={() => onDraft(it.name)}
          onPatch={(patch) => onPatch(it.name, patch)}
          onReview={(state) => onReview(it.name, state)}
        />
      ))}
    </section>
  );
}

const bannerBtn: React.CSSProperties = {
  border: "1px solid currentColor",
  background: "#fff",
  color: "inherit",
  borderRadius: 4,
  padding: "3px 9px",
  fontSize: 11.5,
  cursor: "pointer",
};
