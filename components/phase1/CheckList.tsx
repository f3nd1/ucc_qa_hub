import type { CheckFlag } from "@/lib/qmr-engine";

const COLOUR: Record<CheckFlag["level"], string> = {
  error: "var(--err)",
  warn: "var(--warn)",
  info: "var(--info)",
};

/** The check rail for one activity (or record): deterministic findings, no API. */
export function CheckList({ flags }: { flags: CheckFlag[] }) {
  if (!flags.length) {
    return (
      <div style={{ color: "var(--ok)", fontSize: 12.3 }}>All checks pass.</div>
    );
  }
  return (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {flags.map((f, i) => (
        <li key={i} style={{ color: COLOUR[f.level], fontSize: 12.3, margin: "3px 0" }}>
          {f.msg}
        </li>
      ))}
    </ul>
  );
}
