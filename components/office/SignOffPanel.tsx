import type { Db } from "@/lib/qmr-engine";
import { records, recordOrder } from "@/lib/qmr-engine";

/** Sign-off view: review-state summary per record, weakest points an auditor
    would challenge, and a bulk finalise of everything already Under Review. */
export function SignOffPanel({
  db,
  onBulkFinalise,
  onOpenRecord,
}: {
  db: Db;
  onBulkFinalise: () => void;
  onOpenRecord: (name: string) => void;
}) {
  const order = recordOrder(db);
  let draft = 0,
    review = 0,
    final = 0;
  order.forEach((p) =>
    records(db)[p].items.forEach((it) => {
      const s = it.review_state || "Draft";
      if (s === "Final") final++;
      else if (s === "Under Review") review++;
      else draft++;
    }),
  );

  if (!order.length) return <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No records loaded.</div>;

  return (
    <div style={{ fontSize: 12.5 }}>
      <div style={{ color: "var(--muted)", marginBottom: 10 }}>
        AI recommends, humans decide. Finalising is blocked on blank or placeholder text and stamps the
        reviewer and date.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Chip label="Draft" n={draft} bg="#fff" fg="var(--muted)" />
        <Chip label="Under Review" n={review} bg="#ede7f6" fg="#5e35b1" />
        <Chip label="Final" n={final} bg="#e8f5e9" fg="#2e7d32" />
        <button
          onClick={onBulkFinalise}
          disabled={review === 0}
          style={{
            marginLeft: "auto",
            background: review ? "var(--navy)" : "#c7d0dc",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: review ? "pointer" : "default",
          }}
        >
          Mark all reviewed → final
        </button>
      </div>

      {order.map((p) => {
        const rec = records(db)[p];
        const weak = rec.items.filter((it) => it._critique?.weakest);
        const counts = { Draft: 0, "Under Review": 0, Final: 0 } as Record<string, number>;
        rec.items.forEach((it) => (counts[it.review_state || "Draft"] += 1));
        return (
          <div
            key={p}
            style={{ border: "1px solid var(--border-light)", borderRadius: 6, padding: 10, marginBottom: 8 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <b style={{ color: "var(--navy)" }}>{p}</b>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{rec.criterion}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>
                {counts.Final} final · {counts["Under Review"]} review · {counts.Draft} draft
              </span>
              <button
                onClick={() => onOpenRecord(p)}
                style={{
                  border: "1px solid var(--border)",
                  background: "#fff",
                  color: "var(--navy)",
                  borderRadius: 4,
                  padding: "3px 9px",
                  fontSize: 11.5,
                  cursor: "pointer",
                }}
              >
                Open
              </button>
            </div>
            {weak.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {weak.map((it) => (
                  <div key={it.name} style={{ fontSize: 11.8, color: "#4a3b6b", margin: "2px 0" }}>
                    <b style={{ color: "#5e35b1" }}>{it.activity_name}:</b> {it._critique!.weakest}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Chip({ label, n, bg, fg }: { label: string; n: number; bg: string; fg: string }) {
  return (
    <span style={{ background: bg, color: fg, border: "1px solid var(--border-light)", borderRadius: 12, padding: "3px 11px", fontSize: 12, fontWeight: 600 }}>
      {label}: {n}
    </span>
  );
}
