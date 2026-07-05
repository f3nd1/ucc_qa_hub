import type { Agent, Db } from "@/lib/qmr-engine";
import {
  aiDraft,
  consistencyPass,
  getProcedure,
  getRequirement,
  getS,
  records,
  rowChecks,
  setReview,
} from "@/lib/qmr-engine";
import { kindOf } from "./config";
import type { RunTarget, StepFinding, StepRefusal, StepResult } from "./types";

/* =========================================================
   SPECIALIST RUNNERS

   Each runner maps one agent to engine functions and returns a
   StepResult. Runners never persist: they return a proposedDb that
   the human accepts (or not). Deterministic runners (Grounder,
   Shortfall, Sign-off) need no API key and work offline.
   ========================================================= */

type Runner = (db: Db, agent: Agent, target: RunTarget) => Promise<StepResult>;

function base(agent: Agent, patch: Partial<StepResult>): StepResult {
  return {
    agentId: agent.id,
    agentName: agent.name,
    color: agent.color,
    scope: agent.scope,
    status: "ok",
    summary: "",
    findings: [],
    refusals: [],
    requiresAccept: false,
    ...patch,
  };
}

const label = (it: { activity_name: string; name: string }) => it.activity_name || it.name;

/** Grounder: GD4 requirement + procedure + evidence present and sufficient. */
const grounder: Runner = async (db, agent, target) => {
  const rec = records(db)[target.recordName || ""];
  if (!rec) return base(agent, { status: "error", summary: "No record selected." });

  const refusals: StepRefusal[] = [];
  const findings: StepFinding[] = [];

  if (!getProcedure(db, rec.criterion)) {
    refusals.push({
      activity: "(whole record)",
      question:
        "No procedure is loaded for " +
        rec.criterion +
        ". Add it in the Criterion library so drafting can follow the actual steps.",
    });
    return base(agent, {
      status: "refused",
      refusals,
      summary: "Blocked: no procedure loaded for " + rec.criterion + ". Grounding cannot proceed.",
    });
  }

  let ready = 0;
  if (!getRequirement(db, rec.criterion)) {
    findings.push({
      activity: "(whole record)",
      flag: { level: "info", msg: "No GD4 requirement loaded — drafts will be less audit-aligned." },
    });
  }
  rec.items.forEach((it) => {
    const hasBasis = String(it.evidence_text || "").trim() || String(it._note || "").trim();
    if (!hasBasis)
      findings.push({
        activity: label(it),
        flag: {
          level: "warn",
          msg: "No evidence or note — the Drafter will likely refuse and ask for the specific fact.",
        },
      });
    else ready++;
  });

  return base(agent, {
    status: "ok",
    findings,
    summary:
      ready +
      " of " +
      rec.items.length +
      " activity(ies) have a concrete basis to draft from." +
      (findings.some((f) => f.flag.level === "warn") ? " Some need evidence or a note first." : ""),
  });
};

/** Drafter: aiDraft each activity missing a narrative, one at a time. */
const drafter: Runner = async (db, agent, target) => {
  const rec0 = records(db)[target.recordName || ""];
  if (!rec0) return base(agent, { status: "error", summary: "No record selected." });
  if (!getS(db).openaiKey)
    return base(agent, { status: "no-key", summary: "Drafter needs an OpenAI API key (Settings)." });

  const targets = rec0.items.filter(
    (it) => !String(it.evaluation_text || "").trim() || !String(it.improvement_action || "").trim(),
  );
  if (!targets.length)
    return base(agent, { status: "noop", summary: "Every activity already has a draft. Nothing to write." });

  let cur = db;
  let drafted = 0;
  let errors = 0;
  const refusals: StepRefusal[] = [];
  for (const it of targets) {
    const r = await aiDraft(cur, rec0.name, it.name);
    cur = r.db;
    if (r.status === "drafted") drafted++;
    else if (r.status === "need_input" || r.status === "refused") {
      const row = records(cur)[rec0.name].items.find((x) => x.name === it.name);
      refusals.push({ activity: label(it), question: row?._refusal?.question || r.message });
    } else if (r.status === "error") errors++;
  }

  const changed = drafted > 0 || refusals.length > 0;
  return base(agent, {
    status: drafted ? "ok" : refusals.length ? "refused" : "error",
    refusals,
    proposedDb: changed ? cur : undefined,
    requiresAccept: changed,
    summary:
      drafted +
      " drafted" +
      (refusals.length ? ", " + refusals.length + " refused (need input)" : "") +
      (errors ? ", " + errors + " error(s)" : "") +
      ". Review each before accepting.",
  });
};

/** Shortfall Auditor: rowChecks focused on shortfall / placeholder / off-topic. */
const shortfall: Runner = async (db, agent, target) => {
  const rec = records(db)[target.recordName || ""];
  if (!rec) return base(agent, { status: "error", summary: "No record selected." });

  const findings: StepFinding[] = [];
  rec.items.forEach((it) => {
    rowChecks(db, rec, it).forEach((flag) => {
      // Grounder owns the procedure/requirement notices; skip them here.
      if (flag.level === "info" && !/nil-activity/.test(flag.msg)) return;
      findings.push({ activity: label(it), flag });
    });
  });

  const errors = findings.filter((f) => f.flag.level === "error").length;
  return base(agent, {
    status: errors ? "blocked" : "ok",
    findings,
    summary: findings.length
      ? findings.length + " issue(s) to address" + (errors ? " (" + errors + " blocking)" : "") + "."
      : "No shortfall, placeholder, or off-topic issues found.",
  });
};

/** Consistency Reviewer: harmonise tone across the record, facts unchanged. */
const consistency: Runner = async (db, agent, target) => {
  const rec = records(db)[target.recordName || ""];
  if (!rec) return base(agent, { status: "error", summary: "No record selected." });
  if (!getS(db).openaiKey)
    return base(agent, { status: "no-key", summary: "Consistency Reviewer needs an OpenAI API key." });

  const filled = rec.items.filter((it) => String(it.evaluation_text || "").trim());
  if (filled.length < 2)
    return base(agent, { status: "noop", summary: "Need at least two filled evaluations to harmonise." });

  const r = await consistencyPass(db, rec.name);
  if (r.status === "drafted")
    return base(agent, {
      status: "ok",
      proposedDb: r.db,
      requiresAccept: true,
      summary: "Harmonised " + filled.length + " evaluations. Facts unchanged; review the wording.",
    });
  return base(agent, { status: r.status === "no-key" ? "no-key" : "error", summary: r.message });
};

/** Sign-off Auditor: the final gate. Surfaces weakest points, proposes finalising the ready ones. */
const signoff: Runner = async (db, agent, target) => {
  const rec0 = records(db)[target.recordName || ""];
  if (!rec0) return base(agent, { status: "error", summary: "No record selected." });

  const findings: StepFinding[] = [];
  const eligible: string[] = [];
  rec0.items.forEach((it) => {
    const ev = String(it.evaluation_text || "").trim();
    const imp = String(it.improvement_action || "").trim();
    if (!ev || !imp) {
      findings.push({ activity: label(it), flag: { level: "error", msg: "Blank narrative — cannot finalise." } });
      return;
    }
    if (/\[[^\]]+\]/.test(ev + imp)) {
      findings.push({ activity: label(it), flag: { level: "error", msg: "Placeholder […] text — cannot finalise." } });
      return;
    }
    if (it._critique?.weakest)
      findings.push({ activity: label(it), flag: { level: "info", msg: "Weakest point: " + it._critique.weakest } });
    if ((it.review_state || "Draft") !== "Final") eligible.push(it.name);
  });

  let cur = db;
  eligible.forEach((name) => {
    const r = setReview(cur, rec0.name, name, "Final");
    if (r.status === "ok") cur = r.db;
  });

  const blocked = findings.filter((f) => f.flag.level === "error").length;
  return base(agent, {
    status: blocked ? "blocked" : "ok",
    findings,
    proposedDb: eligible.length ? cur : undefined,
    requiresAccept: eligible.length > 0,
    summary:
      (eligible.length ? eligible.length + " activity(ies) ready to finalise" : "Nothing ready to finalise") +
      (blocked ? ", " + blocked + " blocked (blank or placeholder)" : "") +
      ". You decide.",
  });
};

const RUNNERS: Record<string, Runner> = { grounder, drafter, shortfall, consistency, signoff };

/** Invoke one agent's runner (by kind). Unknown kinds return a no-op error step. */
export async function runAgent(db: Db, agent: Agent, target: RunTarget): Promise<StepResult> {
  const runner = RUNNERS[kindOf(agent)];
  if (!runner) return base(agent, { status: "error", summary: "No runner is defined for " + kindOf(agent) + "." });
  return runner(db, agent, target);
}
