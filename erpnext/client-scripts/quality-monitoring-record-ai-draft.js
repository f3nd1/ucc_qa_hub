/* =========================================================
   Quality Monitoring Record - AI Draft
   DocType: Quality Monitoring Record
   Apply To: Form
   Module (for export): Educ Sg

   Paste this whole file as the Script of a new Client Script record in
   ERPNext (Desk > Client Script > New). It adds an "AI Draft" button group
   with Run and Settings.

   What it does
   ------------
   For every activity in the open record that is missing Evaluation Text or
   Improvement Action, this asks OpenAI to draft both (and the KPI Target
   Description, only if that field is still blank), grounded in the GD4
   requirement and the UCC procedure for this record's Criterion. If it does
   not have a concrete basis to draft from, it refuses that activity and asks
   a specific question instead of inventing a plausible sentence. Nothing is
   auto-saved: you review the draft, then Save the form yourself.

   Where the grounding text comes from
   ------------------------------------
   This DocType has no field for the GD4 requirement or procedure text, only
   a short Criterion code. So this script fetches that text from the same
   place the QMR Agent Office (Next.js) app keeps it:
     1. The qmr_project row in Supabase (the same criterion library the app
        syncs), for requirements[criterion] and procedures[criterion].
     2. If that criterion also has a Drive link recorded, and it points to a
        Google Doc, the script signs in to Google (read-only Drive access)
        and pulls that document's live text, using it as the procedure in
        place of the Supabase-cached copy. Word/PDF Drive links are not
        pulled live here (no bundler available in a plain client script) -
        the Supabase-cached text is used instead for those.
     3. No procedure available from either source: the whole record refuses,
        with a message telling you where to add one.

   This DocType also has no per-activity note or evidence field, so the only
   extra context is the record's Overall Note. That is normally enough for a
   "met target" or "nil period" pattern; for a shortfall it may not explain
   the cause, in which case that one activity refuses and asks for the
   reason rather than guessing.

   One-time setup
   --------------
   Click AI Draft > Settings on any Quality Monitoring Record and fill in:
     - OpenAI API key and model (same as the Next.js app; use a
       spend-capped, scoped key).
     - Supabase project URL and anon key, matching the project the Next.js
       app syncs to (Settings > Supabase there, then Export > Save to
       Supabase once so the criterion library exists in qmr_project).
     - Google OAuth client id, only needed if you want the live Drive pull.
       This ERPNext site's URL must be added as an authorised JavaScript
       origin on that OAuth client in Google Cloud Console.
   These are stored in this browser's localStorage only, matching the
   browser-key pattern used throughout the QMR Agent Office. Every user who
   drafts needs their own OpenAI key configured in their own browser.
   ========================================================= */

frappe.provide("qmr_ai_draft");

frappe.ui.form.on("Quality Monitoring Record", {
  refresh(frm) {
    if (!frm.doc.name) return;
    frm.add_custom_button("Run", () => qmr_ai_draft.run(frm), "AI Draft");
    frm.add_custom_button("Settings", () => qmr_ai_draft.open_settings(), "AI Draft");
  },
});

/* ---- settings, stored in this browser only ---- */

qmr_ai_draft.LS = {
  openai_key: "qmr_ai_openai_key",
  openai_model: "qmr_ai_openai_model",
  self_check: "qmr_ai_self_check",
  google_client_id: "qmr_ai_google_client_id",
  supabase_url: "qmr_ai_supabase_url",
  supabase_key: "qmr_ai_supabase_key",
};

qmr_ai_draft.get_settings = function () {
  return {
    openai_key: localStorage.getItem(qmr_ai_draft.LS.openai_key) || "",
    openai_model: localStorage.getItem(qmr_ai_draft.LS.openai_model) || "gpt-4o-mini",
    self_check: localStorage.getItem(qmr_ai_draft.LS.self_check) !== "false",
    google_client_id: localStorage.getItem(qmr_ai_draft.LS.google_client_id) || "",
    supabase_url: localStorage.getItem(qmr_ai_draft.LS.supabase_url) || "",
    supabase_key: localStorage.getItem(qmr_ai_draft.LS.supabase_key) || "",
  };
};

qmr_ai_draft.open_settings = function () {
  const s = qmr_ai_draft.get_settings();
  const d = new frappe.ui.Dialog({
    title: "AI Draft settings (stored in this browser only)",
    fields: [
      { fieldname: "openai_key", label: "OpenAI API key", fieldtype: "Password", default: s.openai_key },
      { fieldname: "openai_model", label: "OpenAI model", fieldtype: "Data", default: s.openai_model },
      {
        fieldname: "self_check",
        label: "Self-check pass (reviews and corrects its own draft)",
        fieldtype: "Check",
        default: s.self_check ? 1 : 0,
      },
      { fieldname: "sb1", fieldtype: "Section Break", label: "Grounding source" },
      {
        fieldname: "supabase_url",
        label: "Supabase project URL",
        fieldtype: "Data",
        default: s.supabase_url,
        description: "The QMR Agent Office project you sync the criterion library to.",
      },
      { fieldname: "supabase_key", label: "Supabase anon key", fieldtype: "Password", default: s.supabase_key },
      {
        fieldname: "google_client_id",
        label: "Google OAuth client id",
        fieldtype: "Data",
        default: s.google_client_id,
        description:
          "For live-pulling a Google Doc procedure from the criterion's Drive link. This site's URL must be an authorised JavaScript origin on that OAuth client. Leave blank to rely on the Supabase-cached text only.",
      },
    ],
    primary_action_label: "Save",
    primary_action(values) {
      localStorage.setItem(qmr_ai_draft.LS.openai_key, values.openai_key || "");
      localStorage.setItem(qmr_ai_draft.LS.openai_model, values.openai_model || "gpt-4o-mini");
      localStorage.setItem(qmr_ai_draft.LS.self_check, values.self_check ? "true" : "false");
      localStorage.setItem(qmr_ai_draft.LS.supabase_url, values.supabase_url || "");
      localStorage.setItem(qmr_ai_draft.LS.supabase_key, values.supabase_key || "");
      localStorage.setItem(qmr_ai_draft.LS.google_client_id, values.google_client_id || "");
      frappe.show_alert({ message: "AI Draft settings saved.", indicator: "green" });
      d.hide();
    },
  });
  d.show();
};

/* ---- Supabase: the criterion library cache ---- */

qmr_ai_draft.fetch_supabase_criterion = async function (settings, criterion) {
  if (!settings.supabase_url || !settings.supabase_key) {
    return { requirement: "", procedure: "", drive_link: "" };
  }
  const url = settings.supabase_url.replace(/\/+$/, "") + "/rest/v1/qmr_project?id=eq.default&select=data";
  const res = await fetch(url, {
    headers: { apikey: settings.supabase_key, Authorization: "Bearer " + settings.supabase_key },
  });
  if (!res.ok) throw new Error("Supabase fetch failed: HTTP " + res.status);
  const rows = await res.json();
  const data = rows && rows[0] && rows[0].data;
  if (!data) return { requirement: "", procedure: "", drive_link: "" };
  return {
    requirement: (data.requirements && data.requirements[criterion]) || "",
    procedure: (data.procedures && data.procedures[criterion]) || "",
    drive_link: (data.driveLinks && data.driveLinks[criterion]) || "",
  };
};

/* ---- Google Drive: live pull for a Google Doc procedure ---- */

qmr_ai_draft.parse_drive_id = function (url) {
  const s = String(url || "").trim();
  let m = s.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = s.match(/^([a-zA-Z0-9_-]{20,})$/);
  if (m) return m[1];
  return null;
};

qmr_ai_draft.load_gis = function () {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Identity Services."));
    document.head.appendChild(s);
  });
};

qmr_ai_draft.drive_token = async function (client_id) {
  if (!client_id) throw new Error("No Google OAuth client id set in AI Draft Settings.");
  await qmr_ai_draft.load_gis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      callback(resp) {
        if (resp.error || !resp.access_token) reject(new Error(resp.error || "No access token returned."));
        else resolve(resp.access_token);
      },
    });
    client.requestAccessToken();
  });
};

qmr_ai_draft.drive_fetch_text = async function (token, file_id) {
  const auth = { Authorization: "Bearer " + token };
  const meta_res = await fetch("https://www.googleapis.com/drive/v3/files/" + file_id + "?fields=name,mimeType", {
    headers: auth,
  });
  if (!meta_res.ok) throw new Error("Drive metadata HTTP " + meta_res.status);
  const meta = await meta_res.json();
  if (meta.mimeType !== "application/vnd.google-apps.document") {
    throw new Error("Only a Google Doc can be pulled live here. Word/PDF links fall back to the Supabase-cached text.");
  }
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files/" + file_id + "/export?mimeType=text/plain",
    { headers: auth },
  );
  if (!res.ok) throw new Error("Drive export HTTP " + res.status);
  return (await res.text()).trim();
};

/* ---- assemble the grounding for this record's Criterion ---- */

qmr_ai_draft.get_grounding = async function (frm, settings) {
  const criterion = frm.doc.criterion;
  if (!criterion) throw new Error("This record has no Criterion set.");

  const cached = await qmr_ai_draft.fetch_supabase_criterion(settings, criterion);
  let procedure = cached.procedure || "";

  if (cached.drive_link) {
    try {
      const file_id = qmr_ai_draft.parse_drive_id(cached.drive_link);
      if (file_id) {
        const token = await qmr_ai_draft.drive_token(settings.google_client_id);
        const live = await qmr_ai_draft.drive_fetch_text(token, file_id);
        if (live) procedure = live;
      }
    } catch (e) {
      console.warn("Drive pull skipped, using the Supabase-cached procedure instead:", e.message);
    }
  }

  return { requirement: cached.requirement || "", procedure };
};

/* ---- grounded drafting (system prompt ported from the QMR engine) ---- */

qmr_ai_draft.detect_pattern = function (row) {
  const t = row.kpi_target_value;
  const a = row.kpi_actual_value;
  if (a !== null && a !== undefined && a === 0 && t !== null && t !== undefined && t > 0) return "nil";
  if (t !== null && t !== undefined && a !== null && a !== undefined && a < t) return "short";
  return "met";
};

qmr_ai_draft.SYSTEM_PROMPT = [
  "You draft KPI Target Description (only if it is blank), Evaluation Text and Improvement Action for a Quality Monitoring Record activity at United Ceres College (UCC), a Singapore private education institution preparing for an EduTrust audit.",
  "",
  "You are given, in priority order: the GD4 REQUIREMENT for this criterion (what EduTrust expects), the PROCEDURE (how UCC does it, authoritative for steps and evidence), the activity details, the KPI target and actual, and an OVERALL NOTE describing what happened this period.",
  "",
  "GROUNDING RULES (critical):",
  "- Read the GD4 REQUIREMENT first. Show it is satisfied through the procedure. Do not quote the requirement verbatim.",
  "- Your draft must be consistent with the PROCEDURE: reference its actual steps, evidence types and responsibilities. Do not describe generic controls the procedure does not mention.",
  "- Every specific claim must be supported by the KPI actual or the OVERALL NOTE. Do not invent events, numbers, dates, names or evidence.",
  "- If the inputs do not give you a concrete basis (for example a shortfall pattern with no note explaining the cause), do not guess. Refuse instead.",
  "",
  'REFUSAL FORMAT: return {"status":"need_input","missing":["..."],"question":"one plain question asking for the specific fact needed"}.',
  "",
  'WHEN YOU CAN DRAFT, return {"status":"ok","evaluation_text":"...","improvement_action":"...","kpi_target_desc":"only include this if NEEDS_TARGET_DESC is true, otherwise omit it","assumptions":"one sentence","weakest_point":"one sentence, or empty"}.',
  "",
  "STYLE:",
  "- UK British spelling. Never use em dashes.",
  "- Evaluation Text: 1 to 3 sentences, factual, consistent with actual vs target, grounded in the procedure.",
  "- Met or exceeded target: confirm completion, cite the procedure's evidence type.",
  "- Actual is 0 because nothing occurred, per the note: no cases occurred during the monitoring period, controls remain in place and ready.",
  "- Below target: acknowledge the shortfall plainly, state the cause from the note. Never write a fully positive narrative over a shortfall.",
  "- Improvement Action: 1 to 2 sentences. Maintain the current controls when met, or a specific Quality Action with owner and deadline when below target.",
  "- Terminology: teacher not instructor, Quality Action not corrective action plan, SQ for Strategic and Quality Management, Providers capitalised for third party service providers.",
  "Return JSON only, no prose outside the JSON.",
].join("\n");

qmr_ai_draft.SELFCHECK_PROMPT = [
  "You are a strict reviewer of a Quality Monitoring evaluation for UCC.",
  "Check the DRAFT against these rules and the given inputs:",
  "1. UK British spelling, no em dashes.",
  "2. Every factual claim is supported by the KPI actual or the note. No invented events, numbers, names or dates.",
  "3. If actual is below target, the shortfall is acknowledged, not glossed over.",
  "4. The evaluation reflects this activity and its procedure, not a different activity.",
  "5. Improvement Action uses Maintain when met, or a specific Quality Action with owner and deadline when below target.",
  "6. No placeholder [...] text.",
  'If all pass, return {"ok":true}. If any fail, return {"ok":false,"evaluation_text":"corrected version","improvement_action":"corrected version","fixed":"one line on what changed"}.',
  "Return JSON only.",
].join("\n");

qmr_ai_draft.call_openai = async function (settings, messages) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + settings.openai_key },
    body: JSON.stringify({
      model: settings.openai_model,
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("OpenAI HTTP " + res.status + ": " + t.slice(0, 180));
  }
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
};

/* ---- the run, record level: drafts every activity still missing text ---- */

qmr_ai_draft.run = async function (frm) {
  const settings = qmr_ai_draft.get_settings();
  if (!settings.openai_key) {
    frappe.msgprint("Add your OpenAI API key first: AI Draft > Settings.");
    return;
  }

  let grounding;
  try {
    grounding = await qmr_ai_draft.get_grounding(frm, settings);
  } catch (e) {
    frappe.msgprint("Cannot draft: " + e.message);
    return;
  }
  if (!grounding.procedure) {
    frappe.msgprint(
      "No procedure available for " +
        (frm.doc.criterion || "this criterion") +
        ". Add one in the QMR Agent Office criterion library and sync to Supabase, or add a Drive link to a Google Doc, then try again.",
    );
    return;
  }

  const items = frm.doc.items || [];
  const targets = items.filter(
    (r) => !String(r.evaluation_text || "").trim() || !String(r.improvement_action || "").trim(),
  );
  if (!targets.length) {
    frappe.msgprint("No empty activities in this record. Nothing to draft.");
    return;
  }

  frappe.show_alert({
    message: "Drafting " + targets.length + " activit" + (targets.length === 1 ? "y" : "ies") + " ...",
    indicator: "blue",
  });

  let drafted = 0;
  const skipped = [];

  for (const row of targets) {
    const pattern = qmr_ai_draft.detect_pattern(row);
    const needs_target_desc = !String(row.kpi_target_desc || "").trim();
    const payload = {
      gd4_requirement: grounding.requirement || "(none supplied)",
      procedure: grounding.procedure,
      pattern,
      criterion: frm.doc.criterion,
      department: frm.doc.department,
      period: (frm.doc.period_from || "") + " to " + (frm.doc.period_to || ""),
      activity_name: row.activity_name,
      feedback_source: row.feedback_source,
      kpi_metric: row.kpi_metric,
      kpi_target_description: needs_target_desc ? "(none supplied, propose one)" : row.kpi_target_desc,
      needs_target_desc,
      kpi_target_value: row.kpi_target_value,
      kpi_actual_value: row.kpi_actual_value,
      uom: row.uom,
      ownership: row.ownership,
      overall_note: frm.doc.overall_note || "(none provided)",
    };

    try {
      const out = await qmr_ai_draft.call_openai(settings, [
        { role: "system", content: qmr_ai_draft.SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(payload) },
      ]);

      if (out.status === "need_input") {
        skipped.push({ activity: row.activity_name || row.idx, question: out.question || "Needs more information." });
        continue;
      }

      let ev = String(out.evaluation_text || "").trim();
      let imp = String(out.improvement_action || "").trim();

      if (settings.self_check) {
        try {
          const chk = await qmr_ai_draft.call_openai(settings, [
            { role: "system", content: qmr_ai_draft.SELFCHECK_PROMPT },
            {
              role: "user",
              content: JSON.stringify({ inputs: payload, draft: { evaluation_text: ev, improvement_action: imp } }),
            },
          ]);
          if (chk && chk.ok === false) {
            if (chk.evaluation_text) ev = String(chk.evaluation_text).trim();
            if (chk.improvement_action) imp = String(chk.improvement_action).trim();
          }
        } catch (e) {
          console.warn("Self-check skipped:", e.message);
        }
      }

      row.evaluation_text = ev;
      row.improvement_action = imp;
      if (needs_target_desc && out.kpi_target_desc) row.kpi_target_desc = String(out.kpi_target_desc).trim();
      if (row.review_status === "Reviewed") row.review_status = "Under Review";
      drafted++;
    } catch (e) {
      skipped.push({ activity: row.activity_name || row.idx, question: "AI call failed: " + e.message });
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  frm.dirty();
  frm.refresh_field("items");
  frm.trigger("refresh");

  let msg = "Drafted " + drafted + " of " + targets.length + " activit" + (targets.length === 1 ? "y" : "ies") + ".";
  if (skipped.length) {
    msg +=
      "<br><br><b>Needs your input before it can draft:</b><ul>" +
      skipped
        .map(
          (s) =>
            "<li><b>" + frappe.utils.escape_html(String(s.activity)) + ":</b> " + frappe.utils.escape_html(s.question) + "</li>",
        )
        .join("") +
      "</ul>";
  }
  msg += "<br>Nothing is saved yet. Review each activity, then Save the form.";
  frappe.msgprint({ title: "AI Draft", message: msg, indicator: skipped.length ? "orange" : "green" });
};
