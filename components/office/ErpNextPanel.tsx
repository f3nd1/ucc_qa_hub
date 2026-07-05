import { useState } from "react";
import type { Db, ErpRecordSummary } from "@/lib/qmr-engine";
import { erpApiList, erpConfig, erpConfigured, recordOrder, records } from "@/lib/qmr-engine";
import type { Notify } from "../useWorkbench";

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
const ghost: React.CSSProperties = {
  background: "#fff",
  color: "var(--navy)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "6px 11px",
  fontSize: 12,
  cursor: "pointer",
};

/** Read records from ERPNext into the cycle, and write edited fields back.
    Write-back fetches fresh and merges only the edited fields by row name. */
export function ErpNextPanel({
  db,
  notify,
  onImport,
  onWriteBack,
}: {
  db: Db;
  notify: Notify;
  onImport: (names: string[]) => Promise<void>;
  onWriteBack: (parents: string[]) => Promise<{ ok: number; failed: string[] }>;
}) {
  const cfg = erpConfig(db);
  const configured = erpConfigured(cfg);
  const order = recordOrder(db);

  const [list, setList] = useState<ErpRecordSummary[] | null>(null);
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [wb, setWb] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<"" | "list" | "import" | "write">("");

  if (!configured) {
    return (
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
        Set the ERPNext base URL and API key : secret in <b>Settings</b> first. Then you can pull records in and
        write edited fields back.
      </div>
    );
  }

  async function fetchList() {
    setBusy("list");
    try {
      const recs = await erpApiList(cfg);
      setList(recs);
      setPick({});
      if (!recs.length) notify("ERPNext returned no records.", "info");
    } catch (e) {
      notify("List failed: " + (e as Error).message + " (check URL, token, CORS).", "err");
    } finally {
      setBusy("");
    }
  }

  async function importSelected() {
    const names = Object.keys(pick).filter((n) => pick[n]);
    if (!names.length) {
      notify("Nothing selected.", "err");
      return;
    }
    setBusy("import");
    try {
      await onImport(names);
    } catch (e) {
      notify("Import failed: " + (e as Error).message, "err");
    } finally {
      setBusy("");
    }
  }

  async function writeBack() {
    const parents = order.filter((p) => wb[p]);
    if (!parents.length) {
      notify("Select at least one record to write back.", "err");
      return;
    }
    setBusy("write");
    try {
      await onWriteBack(parents);
    } catch (e) {
      notify("Write-back failed: " + (e as Error).message, "err");
    } finally {
      setBusy("");
    }
  }

  return (
    <div style={{ fontSize: 12.5 }}>
      <div style={{ color: "var(--muted)", marginBottom: 12 }}>
        Connected to <span style={{ fontFamily: "var(--mono)" }}>{cfg.url}</span>.
      </div>

      {/* Import */}
      <div style={{ fontWeight: 600, color: "var(--navy)", marginBottom: 6 }}>Load records from ERPNext</div>
      <button style={ghost} onClick={fetchList} disabled={busy === "list"}>
        {busy === "list" ? "Fetching…" : "Fetch record list"}
      </button>
      {list && (
        <div style={{ marginTop: 8 }}>
          <div style={{ border: "1px solid var(--border-light)", borderRadius: 5, maxHeight: 200, overflow: "auto" }}>
            {list.map((r) => (
              <label
                key={r.name}
                style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "6px 9px", borderBottom: "1px solid #f0f2f6", cursor: "pointer" }}
              >
                <input type="checkbox" checked={!!pick[r.name]} onChange={(e) => setPick((p) => ({ ...p, [r.name]: e.target.checked }))} />
                <span>
                  <b>{r.name}</b>{" "}
                  <span style={{ color: "var(--muted)", fontSize: 11.5 }}>
                    {r.department || ""} · {r.criterion || ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <button style={{ ...btn, marginTop: 8 }} onClick={importSelected} disabled={busy === "import"}>
            {busy === "import" ? "Loading…" : "Load selected into current cycle"}
          </button>
        </div>
      )}

      {/* Write-back */}
      <div style={{ fontWeight: 600, color: "var(--navy)", margin: "16px 0 6px" }}>Write edited fields back</div>
      <div style={{ color: "var(--muted)", marginBottom: 6 }}>
        For each record, the fresh document is fetched and only the KPI actual, evaluation, improvement action
        and action status are merged onto matching rows by name. Nothing else is overwritten.
      </div>
      {order.length === 0 ? (
        <div style={{ color: "var(--muted)" }}>No records in the current cycle.</div>
      ) : (
        <>
          <div style={{ border: "1px solid var(--border-light)", borderRadius: 5, maxHeight: 180, overflow: "auto" }}>
            {order.map((p) => (
              <label key={p} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 9px", borderBottom: "1px solid #f0f2f6", cursor: "pointer" }}>
                <input type="checkbox" checked={!!wb[p]} onChange={(e) => setWb((s) => ({ ...s, [p]: e.target.checked }))} />
                <span>
                  <b>{p}</b> <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{records(db)[p].criterion}</span>
                </span>
              </label>
            ))}
          </div>
          <button style={{ ...btn, marginTop: 8 }} onClick={writeBack} disabled={busy === "write"}>
            {busy === "write" ? "Writing…" : "Write back selected"}
          </button>
        </>
      )}
    </div>
  );
}
