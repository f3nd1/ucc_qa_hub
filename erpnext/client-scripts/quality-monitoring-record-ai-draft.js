// ============================================================
// Client Script: Quality Monitoring Record AI Draft
// DocType: Quality Monitoring Record
// Apply To: Form   Module (for export): Educ Sg
//
// Drafts the narrative fields on each activity in the child table
// "items": evaluation_text, improvement_action, and kpi_target_desc
// (only when kpi_target_desc is still blank).
//
// Built in the same style as the Quality Action Resolution AI Draft:
//   - API key prompted via a Text field, cached in sessionStorage,
//     cleared on a 401 (no persisted, clippable key field).
//   - A model dropdown with a Fetch available models button.
//   - Correct token parameters per model family: gpt-4o / gpt-4.x /
//     gpt-3.5 use max_tokens + temperature; newer models (gpt-5.x,
//     o-series) use max_completion_tokens and no temperature.
//
// What is kept specific to QMR, and must not be weakened:
//   - Each draft is grounded in the criterion's GD4 requirement and UCC
//     procedure. You paste these (or pull the procedure from a Google
//     Doc link) in the dialog; they are cached in this browser per
//     criterion, so you fill them in once per criterion.
//   - No procedure means the record refuses to draft. If the model has
//     no concrete basis for an activity (for example a shortfall with no
//     Overall Note explaining the cause), it refuses that activity and
//     asks a specific question instead of inventing a sentence.
//   - Nothing is auto-saved. Review the drafts, then Save the form.
// ============================================================

frappe.ui.form.on("Quality Monitoring Record", {
    refresh(frm) {
        if (!frm.doc.name) return;
        if (frm.custom_buttons && frm.custom_buttons["AI Draft"]) return;
        frm.add_custom_button("AI Draft", () => QMRAI.open_dialog(frm));
    }
});

const QMRAI = {
    KEY_SS: "qmr_ai_key",
    MODEL_LS: "qmr_ai_model",
    SELFCHECK_LS: "qmr_ai_self_check",
    GOOGLE_LS: "qmr_ai_google_client_id",

    // gpt-4o / gpt-4- / gpt-4.1 / gpt-3.5 take max_tokens + temperature.
    // Everything newer (gpt-5.x, o-series) uses max_completion_tokens and
    // rejects temperature.
    is_legacy_model(model) {
        return /^(gpt-4o|gpt-4-|gpt-4\.1|gpt-3\.5)/.test(model || "");
    },

    clear_key() {
        window._qmrKey = null;
        sessionStorage.removeItem(this.KEY_SS);
    },

    get_key() {
        if (!window._qmrKey) window._qmrKey = sessionStorage.getItem(this.KEY_SS);
        if (window._qmrKey) return Promise.resolve(window._qmrKey);
        return new Promise((resolve) => {
            frappe.prompt(
                { label: "OpenAI API Key", fieldname: "key", fieldtype: "Text", reqd: 1 },
                (v) => {
                    window._qmrKey = (v.key || "").trim();
                    sessionStorage.setItem(this.KEY_SS, window._qmrKey);
                    resolve(window._qmrKey);
                },
                "Enter API Key"
            );
        });
    },

    get_google_client_id() {
        const cur = localStorage.getItem(this.GOOGLE_LS) || "";
        if (cur) return Promise.resolve(cur);
        return new Promise((resolve) => {
            frappe.prompt(
                {
                    label: "Google OAuth client id",
                    fieldname: "cid",
                    fieldtype: "Data",
                    reqd: 1,
                    description: "This site's URL must be an authorised JavaScript origin on that OAuth client."
                },
                (v) => {
                    const cid = (v.cid || "").trim();
                    localStorage.setItem(this.GOOGLE_LS, cid);
                    resolve(cid);
                },
                "Google Drive access"
            );
        });
    },

    // ---- OpenAI ----

    async fetch_models(key) {
        const res = await fetch("https://api.openai.com/v1/models", {
            headers: { Authorization: `Bearer ${String(key || "").trim()}` }
        });
        if (!res.ok) {
            if (res.status === 401) this.clear_key();
            throw new Error(`OpenAI ${res.status}`);
        }
        const data = await res.json();
        return (data.data || [])
            .map((m) => m.id)
            .filter(
                (id) =>
                    (/^gpt-/.test(id) || /^o[0-9]/.test(id)) &&
                    !/audio|realtime|search|transcribe|tts|image|instruct|embedding|moderation/.test(id)
            )
            .sort();
    },

    async call_openai(key, model, messages) {
        const body = {
            model: model,
            response_format: { type: "json_object" },
            messages: messages
        };
        if (this.is_legacy_model(model)) {
            body.temperature = 0.15;
            body.max_tokens = 1500;
        } else {
            body.max_completion_tokens = 4000;
        }

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            if (res.status === 401) this.clear_key();
            let detail = "";
            try {
                const err = await res.json();
                detail = err.error && err.error.message ? err.error.message : "";
            } catch (e) {}
            throw new Error(`OpenAI ${res.status}: ${detail}`);
        }

        const data = await res.json();
        const content =
            data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
        if (!content) throw new Error("The model returned an empty response. Try gpt-4o-mini instead.");
        return JSON.parse(content);
    },

    // ---- Google Drive (optional live pull of a Google Doc procedure) ----

    parse_drive_id(url) {
        const s = String(url || "").trim();
        let m = s.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
        if (m) return m[1];
        m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (m) return m[1];
        m = s.match(/^([a-zA-Z0-9_-]{20,})$/);
        if (m) return m[1];
        return null;
    },

    load_gis() {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://accounts.google.com/gsi/client";
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("Failed to load Google Identity Services."));
            document.head.appendChild(s);
        });
    },

    async drive_token(client_id) {
        await this.load_gis();
        return new Promise((resolve, reject) => {
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id,
                scope: "https://www.googleapis.com/auth/drive.readonly",
                callback(resp) {
                    if (resp.error || !resp.access_token) reject(new Error(resp.error || "No access token returned."));
                    else resolve(resp.access_token);
                }
            });
            client.requestAccessToken();
        });
    },

    async drive_fetch_text(token, file_id) {
        const auth = { Authorization: `Bearer ${token}` };
        const meta_res = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file_id}?fields=name,mimeType`,
            { headers: auth }
        );
        if (!meta_res.ok) throw new Error(`Drive metadata ${meta_res.status}`);
        const meta = await meta_res.json();
        if (meta.mimeType !== "application/vnd.google-apps.document") {
            throw new Error("Only a Google Doc can be pulled live. Paste the text in directly for Word or PDF files.");
        }
        const res = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file_id}/export?mimeType=text/plain`,
            { headers: auth }
        );
        if (!res.ok) throw new Error(`Drive export ${res.status}`);
        return (await res.text()).trim();
    },

    // ---- grounding, cached per criterion in this browser ----

    grounding_key(criterion) {
        return "qmr_ai_grounding_" + criterion;
    },
    get_grounding(criterion) {
        try {
            const raw = localStorage.getItem(this.grounding_key(criterion));
            return raw ? JSON.parse(raw) : { requirement: "", procedure: "", drive_link: "" };
        } catch (e) {
            return { requirement: "", procedure: "", drive_link: "" };
        }
    },
    save_grounding(criterion, g) {
        localStorage.setItem(this.grounding_key(criterion), JSON.stringify(g));
    },

    // ---- prompts (ported from the QMR engine, grounded or refuse) ----

    detect_pattern(row) {
        const t = row.kpi_target_value;
        const a = row.kpi_actual_value;
        if (a !== null && a !== undefined && a === 0 && t !== null && t !== undefined && t > 0) return "nil";
        if (t !== null && t !== undefined && a !== null && a !== undefined && a < t) return "short";
        return "met";
    },

    system_prompt() {
        return [
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
            "Return JSON only, no prose outside the JSON."
        ].join("\n");
    },

    selfcheck_prompt() {
        return [
            "You are a strict reviewer of a Quality Monitoring evaluation for UCC.",
            "Check the DRAFT against these rules and the given inputs:",
            "1. UK British spelling, no em dashes.",
            "2. Every factual claim is supported by the KPI actual or the note. No invented events, numbers, names or dates.",
            "3. If actual is below target, the shortfall is acknowledged, not glossed over.",
            "4. The evaluation reflects this activity and its procedure, not a different activity.",
            "5. Improvement Action uses Maintain when met, or a specific Quality Action with owner and deadline when below target.",
            "6. No placeholder [...] text.",
            'If all pass, return {"ok":true}. If any fail, return {"ok":false,"evaluation_text":"corrected version","improvement_action":"corrected version","fixed":"one line on what changed"}.',
            "Return JSON only."
        ].join("\n");
    },

    // ---- the dialog ----

    open_dialog(frm) {
        const criterion = frm.doc.criterion;
        if (!criterion) {
            frappe.msgprint("This record has no Criterion set.");
            return;
        }
        const g = this.get_grounding(criterion);
        const self = this;

        const preset = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-5.4", "gpt-5.4-pro"];
        const saved_model = localStorage.getItem(this.MODEL_LS) || "gpt-4o-mini";
        if (!preset.includes(saved_model)) preset.unshift(saved_model);
        const model_options = window._qmrModels && window._qmrModels.length ? window._qmrModels : preset;
        const self_check_default = localStorage.getItem(this.SELFCHECK_LS) !== "false";

        const d = new frappe.ui.Dialog({
            title: "AI Draft for " + criterion,
            size: "large",
            fields: [
                {
                    label: "Model", fieldname: "model", fieldtype: "Select",
                    options: model_options.join("\n"), default: saved_model
                },
                { label: "Fetch available models", fieldname: "fetch_models", fieldtype: "Button" },
                {
                    label: "Self-check pass (reviews and corrects its own draft)",
                    fieldname: "self_check", fieldtype: "Check", default: self_check_default ? 1 : 0
                },
                { fieldtype: "Section Break", label: "Grounding for " + criterion + " (cached per criterion)" },
                {
                    label: "GD4 requirement (what EduTrust expects)",
                    fieldname: "requirement", fieldtype: "Small Text", default: g.requirement
                },
                {
                    label: "Google Doc link (optional)", fieldname: "drive_link", fieldtype: "Data",
                    default: g.drive_link,
                    description: "Paste a Google Doc link, then click Pull from Drive to load its text into Procedure."
                },
                { label: "Pull from Drive", fieldname: "pull_drive", fieldtype: "Button" },
                {
                    label: "Procedure / SOP text (authoritative, required to draft)",
                    fieldname: "procedure", fieldtype: "Small Text", default: g.procedure
                }
            ],
            primary_action_label: "Draft empty activities",
            primary_action(values) {
                self.save_grounding(criterion, {
                    requirement: values.requirement || "",
                    procedure: values.procedure || "",
                    drive_link: values.drive_link || ""
                });
                localStorage.setItem(self.MODEL_LS, values.model || "gpt-4o-mini");
                localStorage.setItem(self.SELFCHECK_LS, values.self_check ? "true" : "false");
                d.hide();
                self.run(frm, values);
            }
        });

        d.fields_dict.fetch_models.$input.on("click", async () => {
            const key = await self.get_key();
            if (!key) return;
            frappe.dom.freeze("Fetching models...");
            try {
                const list = await self.fetch_models(key);
                if (!list.length) throw new Error("No chat models returned.");
                window._qmrModels = list;
                d.set_df_property("model", "options", list.join("\n"));
                const cur = d.get_value("model");
                if (!list.includes(cur)) d.set_value("model", list.find((m) => /^gpt-4o-mini/.test(m)) || list[0]);
                frappe.show_alert({ message: `Loaded ${list.length} models.`, indicator: "green" });
            } catch (e) {
                frappe.msgprint("Could not fetch models: " + e.message);
            } finally {
                frappe.dom.unfreeze();
            }
        });

        d.fields_dict.pull_drive.$input.on("click", async () => {
            const link = d.get_value("drive_link");
            if (!link) {
                frappe.msgprint("Paste a Google Doc link first.");
                return;
            }
            frappe.dom.freeze("Pulling from Drive...");
            try {
                const file_id = self.parse_drive_id(link);
                if (!file_id) throw new Error("Could not read a file id from that link.");
                const cid = await self.get_google_client_id();
                const token = await self.drive_token(cid);
                const text = await self.drive_fetch_text(token, file_id);
                d.set_value("procedure", text);
                frappe.show_alert({ message: `Pulled ${text.length} characters from Drive.`, indicator: "green" });
            } catch (e) {
                frappe.msgprint("Drive pull failed: " + e.message);
            } finally {
                frappe.dom.unfreeze();
            }
        });

        d.show();
    },

    // ---- the run: draft every activity still missing text ----

    async run(frm, values) {
        const procedure = (values.procedure || "").trim();
        if (!procedure) {
            frappe.msgprint(
                "No procedure text given for " + (frm.doc.criterion || "this criterion") +
                ". Add it in the dialog (paste it, or pull from Drive), then try again."
            );
            return;
        }

        const items = frm.doc.items || [];
        const targets = items.filter(
            (r) => !String(r.evaluation_text || "").trim() || !String(r.improvement_action || "").trim()
        );
        if (!targets.length) {
            frappe.msgprint("No empty activities in this record. Nothing to draft.");
            return;
        }

        const key = await this.get_key();
        if (!key) return;
        const model = values.model || "gpt-4o-mini";
        const self_check = !!values.self_check;

        frappe.dom.freeze(`Drafting ${targets.length} activit${targets.length === 1 ? "y" : "ies"}...`);

        let drafted = 0;
        const skipped = [];

        try {
            for (const row of targets) {
                const pattern = this.detect_pattern(row);
                const needs_target_desc = !String(row.kpi_target_desc || "").trim();
                const payload = {
                    gd4_requirement: values.requirement || "(none supplied)",
                    procedure: procedure,
                    pattern: pattern,
                    criterion: frm.doc.criterion,
                    department: frm.doc.department,
                    period: (frm.doc.period_from || "") + " to " + (frm.doc.period_to || ""),
                    activity_name: row.activity_name,
                    feedback_source: row.feedback_source,
                    kpi_metric: row.kpi_metric,
                    kpi_target_description: needs_target_desc ? "(none supplied, propose one)" : row.kpi_target_desc,
                    needs_target_desc: needs_target_desc,
                    kpi_target_value: row.kpi_target_value,
                    kpi_actual_value: row.kpi_actual_value,
                    uom: row.uom,
                    ownership: row.ownership,
                    overall_note: frm.doc.overall_note || "(none provided)"
                };

                let out;
                try {
                    out = await this.call_openai(key, model, [
                        { role: "system", content: this.system_prompt() },
                        { role: "user", content: JSON.stringify(payload) }
                    ]);
                } catch (e) {
                    // A 401 clears the key; stop the run so the user re-enters it.
                    if (/OpenAI 401/.test(e.message)) {
                        frappe.dom.unfreeze();
                        frappe.msgprint("OpenAI rejected the key (401). It has been cleared. Run AI Draft again to re-enter it.");
                        return;
                    }
                    skipped.push({ activity: row.activity_name || row.idx, question: e.message });
                    continue;
                }

                if (out.status === "need_input") {
                    skipped.push({ activity: row.activity_name || row.idx, question: out.question || "Needs more information." });
                    continue;
                }

                let ev = String(out.evaluation_text || "").trim();
                let imp = String(out.improvement_action || "").trim();

                if (self_check) {
                    try {
                        const chk = await this.call_openai(key, model, [
                            { role: "system", content: this.selfcheck_prompt() },
                            { role: "user", content: JSON.stringify({ inputs: payload, draft: { evaluation_text: ev, improvement_action: imp } }) }
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

                await new Promise((r) => setTimeout(r, 300));
            }
        } finally {
            frappe.dom.unfreeze();
        }

        frm.dirty();
        frm.refresh_field("items");
        frm.trigger("refresh");

        let msg = `Drafted ${drafted} of ${targets.length} activit${targets.length === 1 ? "y" : "ies"}.`;
        if (skipped.length) {
            msg +=
                "<br><br><b>Needs your input before it can draft:</b><ul>" +
                skipped
                    .map((s) => `<li><b>${frappe.utils.escape_html(String(s.activity))}:</b> ${frappe.utils.escape_html(s.question)}</li>`)
                    .join("") +
                "</ul>";
        }
        msg += "<br>Nothing is saved yet. Review each activity, then Save the form.";
        frappe.msgprint({ title: "AI Draft", message: msg, indicator: skipped.length ? "orange" : "green" });
    }
};
