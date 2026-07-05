import type { Db } from "@/lib/qmr-engine";
import { DEMO_PROC, getProcedure, getRequirement, records, recordOrder } from "@/lib/qmr-engine";

/** A light criterion library: which criteria have a requirement and procedure,
    with clear/restore controls (the same setProcedure the engine uses). */
export function CriterionLibrary({
  db,
  onClearProc,
  onRestoreProc,
}: {
  db: Db;
  onClearProc: (criterion: string) => void;
  onRestoreProc: (criterion: string) => void;
}) {
  const crits = Array.from(new Set(recordOrder(db).map((p) => records(db)[p].criterion)))
    .filter(Boolean)
    .sort();

  if (!crits.length) return <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No records loaded yet.</div>;

  return (
    <div style={{ fontSize: 12.5 }}>
      <div style={{ color: "var(--muted)", marginBottom: 10 }}>
        The GD4 requirement and the UCC procedure ground every draft. No procedure means the Drafter refuses.
      </div>
      {crits.map((cr) => {
        const hasProc = !!getProcedure(db, cr);
        const hasReq = !!getRequirement(db, cr);
        const canRestore = !!DEMO_PROC[cr];
        return (
          <div
            key={cr}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 0",
              borderBottom: "1px solid var(--border-light)",
              flexWrap: "wrap",
            }}
          >
            <b style={{ fontFamily: "var(--mono)", color: "var(--navy)", minWidth: 92 }}>{cr}</b>
            <span style={{ color: hasReq ? "var(--ok)" : "#e65100" }}>
              {hasReq ? "requirement ✓" : "no requirement"}
            </span>
            <span style={{ color: hasProc ? "var(--ok)" : "#e65100" }}>
              {hasProc ? "procedure ✓" : "no procedure"}
            </span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {hasProc ? (
                <button onClick={() => onClearProc(cr)} style={miniBtn}>
                  Clear procedure
                </button>
              ) : (
                canRestore && (
                  <button onClick={() => onRestoreProc(cr)} style={miniBtn}>
                    Restore demo procedure
                  </button>
                )
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  border: "1px solid var(--border)",
  background: "#fff",
  color: "var(--navy)",
  borderRadius: 4,
  padding: "3px 8px",
  fontSize: 11.5,
  cursor: "pointer",
};
