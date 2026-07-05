import { useEffect, useRef, useState } from "react";
import type { Db } from "@/lib/qmr-engine";
import {
  DEMO_PROC,
  EXTRACT_SUPPORTED,
  extractText,
  getDriveLink,
  getProcedure,
  getRequirement,
  records,
  recordOrder,
} from "@/lib/qmr-engine";
import type { Notify } from "../useWorkbench";

const label: React.CSSProperties = { fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 2 };
const input: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "6px 7px",
  fontSize: 12,
  background: "#fff",
  fontFamily: "inherit",
};

/** Criterion library: set the GD4 requirement and UCC procedure per criterion,
    by pasting or by uploading a Word/PDF. These ground every draft. */
export function CriterionLibrary({
  db,
  onSave,
  onClearProc,
  onRestoreProc,
  notify,
  initialCriterion,
}: {
  db: Db;
  onSave: (criterion: string, requirement: string, procedure: string, drive: string) => void;
  onClearProc: (criterion: string) => void;
  onRestoreProc: (criterion: string) => void;
  notify: Notify;
  initialCriterion?: string;
}) {
  const existing = Array.from(new Set(recordOrder(db).map((p) => records(db)[p].criterion)))
    .filter(Boolean)
    .sort();

  const [crit, setCrit] = useState<string>(initialCriterion || existing[0] || "");
  const [req, setReq] = useState("");
  const [proc, setProc] = useState("");
  const [drive, setDrive] = useState("");
  const [busy, setBusy] = useState<"" | "req" | "proc">("");

  const reqFile = useRef<HTMLInputElement>(null);
  const procFile = useRef<HTMLInputElement>(null);

  // Load the selected criterion's grounding when the selection changes.
  useEffect(() => {
    setReq(getRequirement(db, crit));
    setProc(getProcedure(db, crit));
    setDrive(getDriveLink(db, crit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crit]);

  async function onUpload(kind: "req" | "proc", file: File | undefined) {
    if (!file) return;
    setBusy(kind);
    try {
      const text = await extractText(file);
      if (!text) {
        notify("No text found in " + file.name + ".", "err");
      } else if (kind === "req") {
        setReq(text);
        notify("Requirement text pulled from " + file.name + ".", "ok");
      } else {
        setProc(text);
        notify("Procedure text pulled from " + file.name + ".", "ok");
      }
    } catch (e) {
      notify("Extract failed: " + (e as Error).message, "err");
    } finally {
      setBusy("");
    }
  }

  return (
    <div style={{ fontSize: 12.5 }}>
      <div style={{ color: "var(--muted)", marginBottom: 10 }}>
        The GD4 requirement is what EduTrust expects; the procedure is how UCC does it (authoritative). Only the
        relevant criterion&apos;s requirement and procedure are sent per draft, never the whole framework. No
        procedure means the Drafter refuses.
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={label}>Criterion</label>
        <input
          style={{ ...input, fontFamily: "var(--mono)" }}
          list="crit-list"
          value={crit}
          onChange={(e) => setCrit(e.target.value)}
          placeholder="e.g. GD4_6.1.1"
        />
        <datalist id="crit-list">
          {existing.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <label style={{ ...label, margin: 0 }}>GD4 requirement text</label>
          <button style={upBtn} onClick={() => reqFile.current?.click()} disabled={busy === "req"}>
            {busy === "req" ? "Extracting…" : "Upload Word / PDF"}
          </button>
          <input
            ref={reqFile}
            type="file"
            accept={EXTRACT_SUPPORTED}
            style={{ display: "none" }}
            onChange={(e) => onUpload("req", e.target.files?.[0])}
          />
        </div>
        <textarea
          style={{ ...input, minHeight: 90, resize: "vertical", lineHeight: 1.4 }}
          value={req}
          onChange={(e) => setReq(e.target.value)}
          placeholder="Paste or upload the GD4 requirement for this criterion…"
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <label style={{ ...label, margin: 0 }}>Procedure / SOP text (authoritative)</label>
          <button style={upBtn} onClick={() => procFile.current?.click()} disabled={busy === "proc"}>
            {busy === "proc" ? "Extracting…" : "Upload Word / PDF"}
          </button>
          <input
            ref={procFile}
            type="file"
            accept={EXTRACT_SUPPORTED}
            style={{ display: "none" }}
            onChange={(e) => onUpload("proc", e.target.files?.[0])}
          />
        </div>
        <textarea
          style={{ ...input, minHeight: 110, resize: "vertical", lineHeight: 1.4 }}
          value={proc}
          onChange={(e) => setProc(e.target.value)}
          placeholder="Paste or upload the SOP: steps, responsibilities, required evidence, timelines, thresholds…"
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={label}>Google Drive link (reference only)</label>
        <input style={input} value={drive} onChange={(e) => setDrive(e.target.value)} placeholder="https://drive.google.com/…" />
      </div>

      <button
        onClick={() => {
          if (!crit.trim()) {
            notify("Enter a criterion first.", "err");
            return;
          }
          onSave(crit.trim(), req, proc, drive);
        }}
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
        Save criterion
      </button>

      {existing.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 600, color: "var(--navy)", marginBottom: 6 }}>Criteria in this cycle</div>
          {existing.map((cr) => {
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
                  padding: "7px 0",
                  borderBottom: "1px solid var(--border-light)",
                  flexWrap: "wrap",
                }}
              >
                <button onClick={() => setCrit(cr)} style={{ ...upBtn, fontFamily: "var(--mono)", minWidth: 92 }}>
                  {cr}
                </button>
                <span style={{ color: hasReq ? "var(--ok)" : "#e65100" }}>{hasReq ? "requirement ✓" : "no requirement"}</span>
                <span style={{ color: hasProc ? "var(--ok)" : "#e65100" }}>{hasProc ? "procedure ✓" : "no procedure"}</span>
                <span style={{ marginLeft: "auto" }}>
                  {hasProc ? (
                    <button onClick={() => onClearProc(cr)} style={upBtn}>
                      Clear procedure
                    </button>
                  ) : (
                    canRestore && (
                      <button onClick={() => onRestoreProc(cr)} style={upBtn}>
                        Restore demo procedure
                      </button>
                    )
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const upBtn: React.CSSProperties = {
  border: "1px solid var(--border)",
  background: "#fff",
  color: "var(--navy)",
  borderRadius: 4,
  padding: "4px 9px",
  fontSize: 11.5,
  cursor: "pointer",
};
