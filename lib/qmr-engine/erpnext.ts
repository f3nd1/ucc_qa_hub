import type { Db, ErpDoc, ErpItem, ErpRecordSummary } from "./types";
import { activeCycle } from "./db";
import { clone } from "./util";
import { mkItem } from "./csv";

/* =========================================================
   ERPNext REST (read + write-back), ported from qmr-workbench.html.

   Write-back is the sensitive part: it fetches the FRESH document first and
   merges ONLY the four edited fields by row name, never overwriting the whole
   record (see CLAUDE.md). All other fields on the fresh document are preserved.
   Browser-side fetch with the token pattern, matching the existing tool.
   ========================================================= */

export interface ErpConfig {
  url: string;
  token: string;
}

export function erpConfig(db: Db): ErpConfig {
  const s = db.settings || {};
  return { url: s.erpUrl || "", token: s.erpToken || "" };
}

const base = (cfg: ErpConfig): string => (cfg.url || "").replace(/\/+$/, "");
const headers = (cfg: ErpConfig): Record<string, string> => ({
  Authorization: "token " + (cfg.token || ""),
  "Content-Type": "application/json",
});

export function erpConfigured(cfg: ErpConfig): boolean {
  return !!(base(cfg) && cfg.token);
}

const RESOURCE = "/api/resource/Quality Monitoring Record";
const str = (v: unknown): string => (v == null ? "" : String(v));

/** List records (name + a little metadata) for the picker. */
export async function apiList(cfg: ErpConfig): Promise<ErpRecordSummary[]> {
  const fields = encodeURIComponent(JSON.stringify(["name", "department", "criterion", "period_from", "period_to"]));
  const url = base(cfg) + RESOURCE + "?fields=" + fields + "&limit_page_length=0&order_by=name asc";
  const res = await fetch(url, { headers: headers(cfg) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return ((await res.json()).data || []) as ErpRecordSummary[];
}

/** Fetch one full record (with its child items). */
export async function apiGet(cfg: ErpConfig, name: string): Promise<ErpDoc> {
  const url = base(cfg) + RESOURCE + "/" + encodeURIComponent(name);
  const res = await fetch(url, { headers: headers(cfg) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return (await res.json()).data as ErpDoc;
}

/** Pure: add already-fetched ERPNext docs as records in the active cycle. */
export function addErpDocs(db: Db, docs: ErpDoc[]): Db {
  const c0 = activeCycle(db);
  if (!c0) return db;
  const d = clone(db);
  const c = activeCycle(d)!;
  docs.forEach((doc) => {
    c.records[doc.name] = {
      name: doc.name,
      department: doc.department || "",
      criterion: doc.criterion || "",
      period_from: doc.period_from || c.period_from,
      period_to: doc.period_to || c.period_to,
      items: (doc.items || []).map((it) =>
        mkItem(d, { criterion: doc.criterion }, {
          name: str(it.name),
          activity_name: str(it.activity_name),
          feedback_source: str(it.feedback_source),
          frequency: str(it.frequency),
          timing: str(it.timing),
          ownership: str(it.ownership),
          kpi_metric: str(it.kpi_metric),
          kpi_target_value: str(it.kpi_target_value),
          kpi_actual_value: str(it.kpi_actual_value),
          uom: str(it.uom),
          kpi_target_desc: str(it.kpi_target_desc),
          evaluation_text: str(it.evaluation_text),
          improvement_action: str(it.improvement_action),
          action_status: str(it.action_status) || "Planned",
        }),
      ),
    };
  });
  return d;
}

/** Fetch full docs for the given names and add them to the active cycle. */
export async function fetchErpRecords(db: Db, cfg: ErpConfig, names: string[]): Promise<Db> {
  const docs: ErpDoc[] = [];
  for (const n of names) docs.push(await apiGet(cfg, n));
  return addErpDocs(db, docs);
}

export interface WriteBackResult {
  ok: number;
  failed: string[];
}

/**
 * Write edited fields back to ERPNext. For each parent: fetch the fresh doc,
 * then merge ONLY kpi_actual_value / evaluation_text / improvement_action /
 * action_status onto the matching child row by name, leaving every other field
 * (and every unmatched row) exactly as it is on the server, then PUT.
 */
export async function writeBackRecords(db: Db, cfg: ErpConfig, parents: string[]): Promise<WriteBackResult> {
  const c = activeCycle(db);
  const out: WriteBackResult = { ok: 0, failed: [] };
  if (!c) return out;
  for (const parent of parents) {
    try {
      const local = c.records[parent];
      if (!local) throw new Error("not in cycle");
      const fresh = await apiGet(cfg, parent);
      const merged: ErpItem[] = (fresh.items || []).map((fi) => {
        const li = local.items.find((x) => x.name === fi.name);
        if (!li) return fi;
        return {
          ...fi,
          kpi_actual_value: li.kpi_actual_value,
          evaluation_text: li.evaluation_text,
          improvement_action: li.improvement_action,
          action_status: li.action_status,
        };
      });
      const put = await fetch(base(cfg) + RESOURCE + "/" + encodeURIComponent(parent), {
        method: "PUT",
        headers: headers(cfg),
        body: JSON.stringify({ items: merged }),
      });
      if (!put.ok) throw new Error("HTTP " + put.status);
      out.ok++;
    } catch {
      out.failed.push(parent);
    }
  }
  return out;
}
