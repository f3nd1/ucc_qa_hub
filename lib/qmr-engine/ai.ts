import type { Db, DraftResponse, Item, QmrRecord, Settings } from "./types";
import { getS, records } from "./db";
import { clone } from "./util";
import { criterionGrounding, getProcedure, getRequirement } from "./criteria";
import { detectPattern } from "./pattern";
import { CONSISTENCY_PROMPT, SELFCHECK_PROMPT, SYSTEM_PROMPT } from "./prompts";

/* =========================================================
   AI DRAFTING (grounded, refuse-when-ungrounded)

   Ported from aiDraft / buildUserPayload / consistencyPass.
   Functions are pure at the boundary: they take a Db and return a
   new Db plus an outcome. Side effects (toasts, persistence, render)
   belong to the caller.
   ========================================================= */

export type DraftStatus = "no-key" | "refused" | "need_input" | "drafted" | "error";

export interface DraftResult {
  db: Db;
  status: DraftStatus;
  message: string;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Only the relevant criterion's grounding + this activity's facts are sent. */
export function buildUserPayload(db: Db, rec: QmrRecord, row: Item) {
  const g = criterionGrounding(db, rec.criterion);
  const pat = detectPattern(row);
  const ex = (db.exemplars || { met: "", nil: "", short: "" })[pat] || "";
  return {
    gd4_requirement: g.requirement || "(none supplied)",
    procedure: g.procedure || "(NONE SUPPLIED)",
    exemplars: ex || "(none supplied)",
    pattern: pat,
    criterion: rec.criterion,
    department: rec.department,
    period: rec.period_from + " to " + rec.period_to,
    activity_name: row.activity_name,
    kpi_metric: row.kpi_metric,
    kpi_target_description: row.kpi_target_desc,
    kpi_target_value: row.kpi_target_value,
    kpi_actual_value: row.kpi_actual_value,
    uom: row.uom,
    feedback_source: row.feedback_source,
    ownership: row.ownership,
    evidence: row.evidence_text || "(none provided)",
    user_note: row._note || "(none provided)",
  };
}

export function pickModel(db: Db): string {
  return getS(db).openaiModel || "gpt-4o-mini";
}

export async function callOpenAI(
  s: Settings,
  model: string,
  messages: ChatMessage[],
): Promise<unknown> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (s.openaiKey || ""),
    },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages,
    }),
  });
  if (!res.ok) {
    const b = await res.text();
    throw new Error("OpenAI HTTP " + res.status + ": " + b.slice(0, 180));
  }
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

/**
 * Draft one activity. Returns a new Db with the row updated to either a draft
 * or a refusal, and never mutates the input.
 *
 * The refuse-when-ungrounded rule is enforced in two layers:
 *   1. Client-side gate: no procedure loaded -> refuse with a precise question,
 *      BEFORE any API call. Provable offline, with no key.
 *   2. Model-side: SYSTEM_PROMPT returns {status:"need_input", question} when it
 *      has no concrete basis; we store that as a refusal and write no narrative.
 * Only status:"ok" ever populates evaluation_text / improvement_action.
 */
export async function aiDraft(db: Db, parent: string, childName: string): Promise<DraftResult> {
  const rec = records(db)[parent];
  if (!rec) return { db, status: "error", message: "Record not found." };
  const row0 = rec.items.find((r) => r.name === childName);
  if (!row0) return { db, status: "error", message: "Activity not found." };

  // Layer 1: client-side grounding gate. No procedure = block, before anything
  // else. This is deterministic and needs neither a key nor a network call, so
  // the refuse rule is provable offline. (The original tool checked the API key
  // first; running the gate first strengthens grounding and never weakens it.)
  if (!getProcedure(db, rec.criterion)) {
    const d = clone(db);
    const row = records(d)[parent].items.find((r) => r.name === childName)!;
    row._refusal = {
      question:
        "No procedure is loaded for " +
        (rec.criterion || "this criterion") +
        ". Add it in the Criterion library so the draft can follow the actual steps.",
      missing: ["procedure for " + rec.criterion],
    };
    return { db: d, status: "refused", message: "No procedure loaded — draft blocked." };
  }

  // Beyond here we call the model, which needs a key.
  const s = getS(db);
  if (!s.openaiKey) return { db, status: "no-key", message: "Add your OpenAI API key in Settings." };

  try {
    const model = pickModel(db);
    const payload = buildUserPayload(db, rec, row0);
    const out = (await callOpenAI(s, model, [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(payload) },
    ])) as DraftResponse;

    const d = clone(db);
    const row = records(d)[parent].items.find((r) => r.name === childName)!;

    // Layer 2: model-side refusal. Write no narrative.
    if (out.status === "need_input") {
      row._refusal = {
        question: out.question || "The AI needs more information to draft this.",
        missing: out.missing || [],
      };
      row._critique = null;
      return {
        db: d,
        status: "need_input",
        message: "AI needs more input for “" + (row.activity_name || childName) + "” — see the note.",
      };
    }

    row._refusal = null;
    let ev = String(out.evaluation_text || "").trim();
    let imp = String(out.improvement_action || "").trim();
    let fixedNote = "";

    // Optional self-check pass: AI reviews and corrects its own draft.
    if (s.selfCheck) {
      try {
        const chk = (await callOpenAI(s, model, [
          { role: "system", content: SELFCHECK_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              inputs: payload,
              draft: { evaluation_text: ev, improvement_action: imp },
            }),
          },
        ])) as { ok?: boolean; evaluation_text?: string; improvement_action?: string; fixed?: string };
        if (chk && chk.ok === false) {
          if (chk.evaluation_text) ev = String(chk.evaluation_text).trim();
          if (chk.improvement_action) imp = String(chk.improvement_action).trim();
          fixedNote = chk.fixed || "self-check applied corrections";
        }
      } catch (e) {
        console.warn("self-check skipped:", (e as Error).message);
      }
    }

    row.evaluation_text = ev;
    row.improvement_action = imp;
    row._critique = { assumptions: out.assumptions || "", weakest: out.weakest_point || "", fixed: fixedNote, model };
    if (row.review_state === "Final") row.review_state = "Under Review";

    return {
      db: d,
      status: "drafted",
      message: "Draft ready for “" + (row.activity_name || childName) + "” — review before finalising.",
    };
  } catch (e) {
    return { db, status: "error", message: "AI draft failed: " + (e as Error).message };
  }
}

/**
 * Whole-record consistency pass: harmonise tone across a record's filled
 * evaluations so they read as one voice. Facts stay unchanged.
 */
export async function consistencyPass(db: Db, parent: string): Promise<DraftResult> {
  const s = getS(db);
  if (!s.openaiKey) return { db, status: "no-key", message: "Add your OpenAI API key in Settings." };
  const rec = records(db)[parent];
  if (!rec) return { db, status: "error", message: "Record not found." };
  if (!getProcedure(db, rec.criterion))
    return { db, status: "refused", message: "Add the SOP for " + (rec.criterion || "this criterion") + " first." };

  const filled = rec.items.filter((it) => String(it.evaluation_text || "").trim());
  if (filled.length < 2)
    return { db, status: "error", message: "Need at least two filled evaluations to harmonise." };

  try {
    const model = pickModel(db);
    const inp = {
      criterion: rec.criterion,
      requirement: getRequirement(db, rec.criterion),
      items: filled.map((it) => ({
        name: it.name,
        activity_name: it.activity_name,
        evaluation_text: it.evaluation_text,
        improvement_action: it.improvement_action,
      })),
    };
    const out = (await callOpenAI(s, model, [
      { role: "system", content: CONSISTENCY_PROMPT },
      { role: "user", content: JSON.stringify(inp) },
    ])) as { items?: Array<{ name: string; evaluation_text?: string; improvement_action?: string }> };

    const d = clone(db);
    const recD = records(d)[parent];
    (out.items || []).forEach((o) => {
      const it = recD.items.find((x) => x.name === o.name);
      if (it) {
        if (o.evaluation_text) it.evaluation_text = String(o.evaluation_text).trim();
        if (o.improvement_action) it.improvement_action = String(o.improvement_action).trim();
        if (it.review_state === "Final") it.review_state = "Under Review";
      }
    });
    return { db: d, status: "drafted", message: "Record harmonised — review the wording, facts are unchanged." };
  } catch (e) {
    return { db, status: "error", message: "Consistency pass failed: " + (e as Error).message };
  }
}
