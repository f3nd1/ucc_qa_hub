import type { Db, Filter } from "@/lib/qmr-engine";
import {
  filterActive,
  getProcedure,
  parseCriterion,
  recChecks,
  recordOrder,
  recordPassesFilter,
  records,
  rowChecks,
} from "@/lib/qmr-engine";

const STATUSES = ["Planned", "In Progress", "Completed", "Deferred"];
const REVIEWS = ["Draft", "Under Review", "Final"];

/** The records sidebar: filters, bulk actions, and the record list with badges. */
export function Sidebar({
  db,
  filter,
  onFilter,
  selected,
  onSelect,
  onDraftAll,
  onCarryForward,
  onFinaliseAll,
}: {
  db: Db;
  filter: Filter;
  onFilter: (f: Filter) => void;
  selected: string | null;
  onSelect: (name: string) => void;
  onDraftAll: () => void;
  onCarryForward: () => void;
  onFinaliseAll: () => void;
}) {
  const order = recordOrder(db);
  const shown = order.filter((p) => recordPassesFilter(records(db)[p], filter));

  const mains = new Set<string>();
  const subs = new Set<string>();
  const depts = new Set<string>();
  order.forEach((p) => {
    const rec = records(db)[p];
    const pc = parseCriterion(rec.criterion);
    if (pc.main) mains.add(pc.main);
    if (pc.subKey && pc.subKey !== "(other)") subs.add(pc.subKey);
    if (rec.department) depts.add(rec.department);
  });
  const subArr = Array.from(subs)
    .sort()
    .filter((sk) => !filter.main || parseCriterion(sk).main === filter.main);

  const count = order.length ? (filterActive(filter) ? shown.length + "/" + order.length : order.length + " loaded") : "";

  return (
    <div className="sidebar">
      <div className="side-head">
        <span>Records</span>
        <span style={{ color: "var(--muted)", fontWeight: 400 }}>{count}</span>
      </div>

      {order.length > 0 && (
        <>
          <div className="filter-bar">
            <div className="filter-row">
              <select className="filt" value={filter.main} onChange={(e) => onFilter({ ...filter, main: e.target.value, sub: "" })}>
                <option value="">All main criteria</option>
                {Array.from(mains)
                  .sort((a, b) => Number(a) - Number(b))
                  .map((m) => (
                    <option key={m} value={m}>
                      GD4.{m}
                    </option>
                  ))}
              </select>
              <select className="filt" value={filter.sub} onChange={(e) => onFilter({ ...filter, sub: e.target.value })}>
                <option value="">All sub-criteria</option>
                {subArr.map((sk) => (
                  <option key={sk} value={sk}>
                    {sk}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-row">
              <select className="filt" value={filter.department} onChange={(e) => onFilter({ ...filter, department: e.target.value })}>
                <option value="">All departments</option>
                {Array.from(depts)
                  .sort()
                  .map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
              </select>
              <select className="filt" value={filter.status} onChange={(e) => onFilter({ ...filter, status: e.target.value })}>
                <option value="">Any status</option>
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select className="filt" value={filter.review} onChange={(e) => onFilter({ ...filter, review: e.target.value })}>
                <option value="">Any review</option>
                {REVIEWS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            {filterActive(filter) && (
              <button className="filt-clear" onClick={() => onFilter({ main: "", sub: "", department: "", status: "", review: "" })}>
                Clear filters
              </button>
            )}
          </div>

          <div className="bulk-bar">
            <button onClick={onDraftAll}>AI draft all empty (all records)</button>
            <button onClick={onCarryForward}>Carry forward prior cycle</button>
            <button onClick={onFinaliseAll}>Mark all reviewed → final</button>
          </div>
        </>
      )}

      <div>
        {order.length === 0 ? (
          <div style={{ padding: 14, color: "var(--muted)" }}>No records in this cycle. Use Import records.</div>
        ) : shown.length === 0 ? (
          <div style={{ padding: 14, color: "var(--muted)" }}>No records match the filters.</div>
        ) : (
          shown.map((p) => {
            const rec = records(db)[p];
            const total = rec.items.length;
            const filled = rec.items.filter(
              (r) => String(r.evaluation_text || "").trim() && String(r.improvement_action || "").trim() && r.kpi_actual_value !== null,
            ).length;
            const flags =
              rec.items.reduce((s, r) => s + rowChecks(db, rec, r).filter((f) => f.level !== "info").length, 0) + recChecks(rec).length;
            const finals = rec.items.filter((r) => r.review_state === "Final").length;
            const noProc = !getProcedure(db, rec.criterion);
            return (
              <div key={p} className={"rec-item" + (selected === p ? " active" : "")} onClick={() => onSelect(p)}>
                <div className="rname">{p}</div>
                <div className="rmeta">
                  {rec.department}
                  {rec.criterion ? " · " + rec.criterion : ""}
                </div>
                <div className="rbadges">
                  <span className={"mini-badge " + (filled === total ? "mb-done" : "mb-empty")}>
                    {filled}/{total} filled
                  </span>
                  {finals > 0 && (
                    <span className="mini-badge mb-review">
                      {finals}/{total} final
                    </span>
                  )}
                  {flags > 0 && (
                    <span className="mini-badge mb-flag">
                      {flags} flag{flags > 1 ? "s" : ""}
                    </span>
                  )}
                  {noProc && <span className="mini-badge mb-noproc">no SOP</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
