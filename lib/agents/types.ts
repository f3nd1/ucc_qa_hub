import type { AgentScope, CheckFlag, Db } from "@/lib/qmr-engine";

/* =========================================================
   Agent run model (flat, Phase 2)

   A "run" is: the orchestrator plans, then invokes specialists in
   sequence. Each specialist produces a StepResult that the human
   accepts or rejects before the next runs. Nothing auto-applies.
   ========================================================= */

export interface RunTarget {
  scope: AgentScope;
  recordName?: string;
}

export type StepStatus = "ok" | "refused" | "blocked" | "no-key" | "error" | "noop";

export interface StepRefusal {
  activity: string;
  question: string;
}

export interface StepFinding {
  activity: string;
  flag: CheckFlag;
}

export interface StepResult {
  agentId: string;
  agentName: string;
  color: string;
  scope: AgentScope;
  status: StepStatus;
  summary: string;
  findings: StepFinding[];
  refusals: StepRefusal[];
  /** Present when the step proposes a change to the Db; applied only on accept. */
  proposedDb?: Db;
  /** True when there is a proposed change awaiting a human accept/reject. */
  requiresAccept: boolean;
}

export type StepDecision = "pending" | "accepted" | "rejected" | "acknowledged";

export interface RunStep {
  result: StepResult;
  decision: StepDecision;
}
