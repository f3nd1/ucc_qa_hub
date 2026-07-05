import type { Db, Filter } from "@/lib/qmr-engine";
import { parseCriterion, records, recordOrder } from "@/lib/qmr-engine";

const label: React.CSSProperties = { fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 2 };
const input: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "5px 6px",
  fontSize: 12,
  background: "#fff",
  fontFamily: "inherit",
};

const STATUSES = ["Planned", "In Progress", "Completed", "Deferred"];
const REVIEWS = ["Draft", "Under Review", "Final"];

/** Two-level GD4 (main -> sub), department, status and review-state filters.
    The filtered set drives which tiles show on the records shelf. */
export function FiltersPanel({
  db,
  filter,
  onChange,
  matchCount,
  totalCount,
}: {
  db: Db;
  filter: Filter;
  onChange: (f: Filter) => void;
  matchCount: number;
  totalCount: number;
}) {
  const order = recordOrder(db);
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

  const set = (patch: Partial<Filter>) => onChange({ ...filter, ...patch });

  return (
    <div style={{ fontSize: 12.5 }}>
      <div style={{ color: "var(--muted)", marginBottom: 10 }}>
        Showing {matchCount} of {totalCount} record(s) on the shelf.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 130px" }}>
          <label style={label}>Main criterion</label>
          <select value={filter.main} onChange={(e) => set({ main: e.target.value, sub: "" })} style={input}>
            <option value="">All main criteria</option>
            {Array.from(mains)
              .sort((a, b) => Number(a) - Number(b))
              .map((m) => (
                <option key={m} value={m}>
                  GD4.{m}
                </option>
              ))}
          </select>
        </div>
        <div style={{ flex: "1 1 130px" }}>
          <label style={label}>Sub-criterion</label>
          <select value={filter.sub} onChange={(e) => set({ sub: e.target.value })} style={input}>
            <option value="">All sub-criteria</option>
            {subArr.map((sk) => (
              <option key={sk} value={sk}>
                {sk}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: "1 1 130px" }}>
          <label style={label}>Department</label>
          <select value={filter.department} onChange={(e) => set({ department: e.target.value })} style={input}>
            <option value="">All departments</option>
            {Array.from(depts)
              .sort()
              .map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
          </select>
        </div>
        <div style={{ flex: "1 1 130px" }}>
          <label style={label}>Action status</label>
          <select value={filter.status} onChange={(e) => set({ status: e.target.value })} style={input}>
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: "1 1 130px" }}>
          <label style={label}>Review state</label>
          <select value={filter.review} onChange={(e) => set({ review: e.target.value })} style={input}>
            <option value="">Any review</option>
            {REVIEWS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={() => onChange({ main: "", sub: "", department: "", status: "", review: "" })}
        style={{
          marginTop: 10,
          border: "1px solid var(--border)",
          background: "#fff",
          color: "var(--navy)",
          borderRadius: 4,
          padding: "5px 12px",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Clear filters
      </button>
    </div>
  );
}
