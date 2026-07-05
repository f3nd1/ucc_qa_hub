/* =========================================================
   QMR engine data model (ported from qmr-workbench.html)

   Everything lives under one Db value. In the original tool it
   was a single localStorage blob so one project file is a faithful
   snapshot and a Supabase adapter can mirror the same shape.

   Cross-cycle (set up once, reused every period):
     procedures, requirements, driveLinks, exemplars, noteBank, settings
   Per-cycle:
     records -> items
   ========================================================= */

export type ReviewState = "Draft" | "Under Review" | "Final";
export type ActionStatus = "Planned" | "In Progress" | "Completed" | "Deferred";

/** Which exemplar set / style guidance an activity draws on. */
export type Pattern = "met" | "nil" | "short";

/** AI self-assessment attached to a drafted item. */
export interface Critique {
  assumptions: string;
  weakest: string;
  fixed: string;
  model: string;
}

/** Prior-cycle narrative carried forward as a starting point. */
export interface Carry {
  evaluation_text: string;
  improvement_action: string;
}

/** A refusal: the AI (or the client-side gate) declines to draft and asks a precise question. */
export interface Refusal {
  question: string;
  missing: string[];
}

export interface Item {
  name: string;
  activity_name: string;
  feedback_source: string;
  frequency: string;
  timing: string;
  ownership: string;
  kpi_metric: string;
  kpi_target_value: number | null;
  kpi_actual_value: number | null;
  uom: string;
  kpi_target_desc: string;
  evaluation_text: string;
  improvement_action: string;
  action_status: ActionStatus | string;
  review_state: ReviewState;
  reviewed_by: string;
  reviewed_on: string;
  evidence_text: string;
  _note: string;
  _refusal: Refusal | null;
  _critique: Critique | null;
  _carry: Carry | null;
}

/** A Quality Monitoring Record (the ERPNext parent), keyed by its name. */
export interface QmrRecord {
  name: string;
  department: string;
  criterion: string;
  period_from: string;
  period_to: string;
  items: Item[];
}

export interface Cycle {
  id: string;
  name: string;
  period_from: string;
  period_to: string;
  created: string;
  seededFrom: string | null;
  records: Record<string, QmrRecord>;
}

export interface Settings {
  openaiKey?: string;
  openaiModel?: string;
  finalModel?: string;
  selfCheck?: boolean;
  erpUrl?: string;
  erpToken?: string;
  reviewer?: string;
}

export interface Exemplars {
  met: string;
  nil: string;
  short: string;
}

export interface Db {
  settings: Settings;
  procedures: Record<string, string>; // criterion -> SOP text (shared across cycles)
  requirements: Record<string, string>; // criterion -> GD4 requirement (shared)
  driveLinks: Record<string, string>; // criterion -> Drive URL bookmark (shared)
  exemplars: Exemplars; // house-voice few-shot, by pattern (shared)
  activeCycle: string | null;
  cycles: Record<string, Cycle>;
  noteBank: Record<string, string>; // activityKey -> reusable note (shared)
}

/** A single check finding for the check rail. */
export interface CheckFlag {
  level: "error" | "warn" | "info";
  msg: string;
}

/** Raw JSON the model returns from a draft call. */
export type DraftResponse =
  | {
      status: "ok";
      evaluation_text?: string;
      improvement_action?: string;
      assumptions?: string;
      weakest_point?: string;
    }
  | { status: "need_input"; missing?: string[]; question?: string };
