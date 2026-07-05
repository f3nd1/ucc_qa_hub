import type { Agent } from "@/lib/qmr-engine";
import { CANONICAL_ORDER } from "./config";
import type { RunTarget } from "./types";

/* =========================================================
   ORCHESTRATOR (deterministic planner, Phase 2)

   The orchestrator plans which specialists to run and in what order,
   then the runner invokes them sequentially. A free-text instruction
   can narrow the plan by keyword. A model-driven planner can slot in
   here later without changing the run loop.
   ========================================================= */

/** Enabled specialists (never the orchestrator itself), in canonical order. */
export function enabledSpecialists(agents: Agent[]): Agent[] {
  const byId = new Map(agents.map((a) => [a.id, a] as const));
  return CANONICAL_ORDER.map((id) => byId.get(id)).filter((a): a is Agent => !!a && a.enabled);
}

/**
 * Plan a run. Default is the full enabled pipeline; a free-text
 * instruction narrows it by keyword (e.g. "just draft", "check for
 * shortfalls", "finalise").
 */
export function planRun(agents: Agent[], _target: RunTarget, instruction?: string): Agent[] {
  const full = enabledSpecialists(agents);
  const t = (instruction || "").toLowerCase().trim();
  if (!t) return full;

  const wants = new Set<string>();
  if (/draft|write|fill/.test(t)) {
    wants.add("grounder");
    wants.add("drafter");
  }
  if (/check|audit|shortfall|issue|review/.test(t)) {
    wants.add("grounder");
    wants.add("shortfall");
  }
  if (/consist|harmoni|voice|tone/.test(t)) wants.add("consistency");
  if (/final|sign.?off|approve/.test(t)) wants.add("signoff");

  return wants.size ? full.filter((a) => wants.has(a.id)) : full;
}

export function planNarrative(plan: Agent[], target: RunTarget): string {
  if (!plan.length) return "No specialists are enabled. Enable at least one in the roster.";
  const where = target.recordName || "the current selection";
  return (
    "Plan for " +
    where +
    ": " +
    plan.map((a) => a.name).join(" → ") +
    ". Each step pauses for your accept or reject."
  );
}
