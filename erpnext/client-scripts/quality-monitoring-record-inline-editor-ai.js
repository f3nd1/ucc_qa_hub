// ============================================================
// Client Script: Quality Monitoring Record - Inline Editor with AI Draft
// DocType: Quality Monitoring Record   Apply To: Form
// Module (for export): Educ Sg
//
// This REPLACES your existing "Quality Monitoring Record - User Interface"
// client script. It renders the same activity cards, and adds AI drafting
// right where you edit:
//   - A "Draft" button on each activity card, which fills that activity's
//     KPI Target Description (only if blank), Evaluation Text and
//     Improvement Action.
//   - A "Draft all empty" button at the top for the whole record.
//
// After pasting this in, DISABLE or delete the separate AI Draft client
// script and the old User Interface script, so only this one runs.
// Keep the "Childtable Clone" (template) script as it is.
//
// Grounding, and the rule that must not be weakened:
//   - Each draft is grounded in this criterion's GD4 requirement and UCC
//     procedure. Click "Grounding & model" once per criterion to paste them
//     (or pull the procedure from a Google Doc link). They are cached in
//     this browser per criterion.
//   - No procedure means it will not draft. If an activity has no concrete
//     basis (for example a shortfall with no Overall Note explaining the
//     cause), that activity refuses and asks a question instead of inventing.
//   - The API key is entered once per browser session (not stored in a
//     form field) and cleared automatically if OpenAI rejects it.
//   - Nothing is auto-saved. Review the drafts, then Save the form.
// ============================================================

frappe.ui.form.on("Quality Monitoring Record", {
    refresh(frm) {
        if (!frm.doc.name) return;
        if (!frm.fields_dict.qmr_inline_editor) {
            frm.add_custom_field({ fieldtype: "HTML", fieldname: "qmr_inline_editor", label: "Inline Editor" });
        }
        QMR.render(frm);
    }
});

const QMR = {
    KEY_SS: "qmr_ai_key",
    MODEL_LS: "qmr_ai_model",
    SELFCHECK_LS: "qmr_ai_self_check",
    GOOGLE_LS: "qmr_ai_google_client_id",
    HIDE_TIPS_LS: "qmr_ai_hide_tips",

    FREQ: ["Monthly", "Quarterly", "Annually", "Biannual", "Biennially", "Each Semester"],
    TIMING: ["Department Meeting", "Management Review", "Quarterly Review", "Annual Audit"],
    ACTION: ["Planned", "In Progress", "Completed", "Deferred"],

    // ---- small helpers ----
    strip(html) {
        return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    },
    esc(v) {
        return frappe.utils.escape_html(String(v == null ? "" : v));
    },
    opt(arr, cur) {
        return arr.map((x) => `<option ${x === cur ? "selected" : ""}>${x}</option>`).join("");
    },
    header_class(status) {
        if (status === "Planned") return "qmr-header-planned";
        if (status === "In Progress") return "qmr-header-in-progress";
        if (status === "Completed") return "qmr-header-completed";
        if (status === "Deferred") return "qmr-header-deferred";
        return "";
    },
    is_legacy_model(model) {
        return /^(gpt-4o|gpt-4-|gpt-4\.1|gpt-3\.5)/.test(model || "");
    },
    get_model() {
        return localStorage.getItem(this.MODEL_LS) || "gpt-4o-mini";
    },

    // ---- key: prompted once per session, cleared on 401 ----
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

    // ---- grounding, cached per criterion ----
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
        const body = { model, response_format: { type: "json_object" }, messages };
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
            const e = new Error(`OpenAI ${res.status}: ${detail}`);
            e.status = res.status;
            throw e;
        }
        const data = await res.json();
        const content =
            data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
        if (!content) throw new Error("The model returned an empty response. Try gpt-4o-mini.");
        return JSON.parse(content);
    },

    // ---- Google Drive (optional live pull of a Google Doc procedure) ----
    get_google_client_id() {
        const cur = localStorage.getItem(this.GOOGLE_LS) || "";
        if (cur) return Promise.resolve(cur);
        return new Promise((resolve) => {
            frappe.prompt(
                { label: "Google OAuth client id", fieldname: "cid", fieldtype: "Text", reqd: 1 },
                (v) => {
                    const cid = (v.cid || "").trim();
                    localStorage.setItem(this.GOOGLE_LS, cid);
                    resolve(cid);
                },
                "Google Drive access"
            );
        });
    },
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
                    if (resp.error || !resp.access_token) reject(new Error(resp.error || "No access token."));
                    else resolve(resp.access_token);
                }
            });
            client.requestAccessToken();
        });
    },
    async drive_fetch_text(token, file_id) {
        const auth = { Authorization: `Bearer ${token}` };
        const meta_res = await fetch(`https://www.googleapis.com/drive/v3/files/${file_id}?fields=name,mimeType`, { headers: auth });
        if (!meta_res.ok) throw new Error(`Drive metadata ${meta_res.status}`);
        const meta = await meta_res.json();
        if (meta.mimeType !== "application/vnd.google-apps.document")
            throw new Error("Only a Google Doc can be pulled live. Paste the text for Word or PDF.");
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file_id}/export?mimeType=text/plain`, { headers: auth });
        if (!res.ok) throw new Error(`Drive export ${res.status}`);
        return (await res.text()).trim();
    },

    // ---- prompts (grounded or refuse) ----
    detect_pattern(row) {
        const t = row.kpi_target_value, a = row.kpi_actual_value;
        if (a !== null && a !== undefined && a === 0 && t !== null && t !== undefined && t > 0) return "nil";
        if (t !== null && t !== undefined && a !== null && a !== undefined && a < t) return "short";
        return "met";
    },
    system_prompt() {
        return [
            "You draft KPI Target Description (only if it is blank), Evaluation Text and Improvement Action for a Quality Monitoring Record activity at United Ceres College (UCC), a Singapore private education institution preparing for an EduTrust audit.",
            "",
            "You are given, in priority order: the GD4 REQUIREMENT for this criterion, the PROCEDURE (how UCC does it, authoritative for steps and evidence), the activity details, the KPI target and actual, and an OVERALL NOTE describing what happened this period.",
            "",
            "GROUNDING RULES (critical):",
            "- Read the GD4 REQUIREMENT first. Show it is satisfied through the procedure. Do not quote it verbatim.",
            "- Your draft must be consistent with the PROCEDURE: reference its actual steps, evidence types and responsibilities. Do not describe generic controls the procedure does not mention.",
            "- Every specific claim must be supported by the KPI actual or the OVERALL NOTE. Do not invent events, numbers, dates, names or evidence.",
            "- If the inputs do not give a concrete basis (for example a shortfall with no note explaining the cause), do not guess. Refuse instead.",
            "",
            'REFUSAL FORMAT: return {"status":"need_input","missing":["..."],"question":"one plain question asking for the specific fact needed"}.',
            "",
            'WHEN YOU CAN DRAFT, return {"status":"ok","evaluation_text":"...","improvement_action":"...","kpi_target_desc":"include only if NEEDS_TARGET_DESC is true, otherwise omit"}.',
            "",
            "STYLE:",
            "- UK British spelling. Never use em dashes.",
            "- Evaluation Text: 1 to 3 sentences, factual, consistent with actual vs target, grounded in the procedure.",
            "- Met or exceeded target: confirm completion, cite the procedure's evidence type.",
            "- Actual is 0 because nothing occurred, per the note: no cases occurred during the monitoring period, controls remain in place and ready.",
            "- Below target: acknowledge the shortfall plainly, state the cause from the note. Never write a fully positive narrative over a shortfall.",
            "- Improvement Action: 1 to 2 sentences. Maintain the current controls when met, or a specific Quality Action with owner and deadline when below target.",
            "- Terminology: teacher not instructor, Quality Action not corrective action plan, SQ for Strategic and Quality Management, Providers capitalised for third party service providers.",
            "Return JSON only."
        ].join("\n");
    },
    selfcheck_prompt() {
        return [
            "You are a strict reviewer of a Quality Monitoring evaluation for UCC.",
            "Check the DRAFT against these rules and the inputs:",
            "1. UK British spelling, no em dashes.",
            "2. Every factual claim is supported by the KPI actual or the note. No invented events, numbers, names or dates.",
            "3. If actual is below target, the shortfall is acknowledged.",
            "4. The evaluation reflects this activity and its procedure.",
            "5. Improvement Action uses Maintain when met, or a specific Quality Action with owner and deadline when below target.",
            "6. No placeholder [...] text.",
            'If all pass return {"ok":true}. If any fail return {"ok":false,"evaluation_text":"corrected","improvement_action":"corrected"}.',
            "Return JSON only."
        ].join("\n");
    },

    // ---- draft one activity row (by idx) ----
    async draft_row(frm, idx, opts) {
        opts = opts || {};
        const criterion = frm.doc.criterion;
        if (!criterion) {
            if (!opts.silent) frappe.msgprint("This record has no Criterion set.");
            return "error";
        }
        const g = this.get_grounding(criterion);
        if (!String(g.procedure || "").trim()) {
            if (!opts.silent) {
                frappe.msgprint("No procedure set for " + criterion + ". Click 'Grounding & model' first.");
                this.open_grounding(frm);
            }
            return "no-proc";
        }
        const row = (frm.doc.items || []).find((r) => String(r.idx) === String(idx));
        if (!row) return "error";

        const key = await this.get_key();
        if (!key) return "error";
        const model = this.get_model();
        const self_check = localStorage.getItem(this.SELFCHECK_LS) !== "false";

        const needs_target_desc = !String(row.kpi_target_desc || "").trim();
        const payload = {
            gd4_requirement: g.requirement || "(none supplied)",
            procedure: g.procedure,
            pattern: this.detect_pattern(row),
            criterion,
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
            overall_note: frm.doc.overall_note || "(none provided)"
        };

        let out;
        try {
            out = await this.call_openai(key, model, [
                { role: "system", content: this.system_prompt() },
                { role: "user", content: JSON.stringify(payload) }
            ]);
        } catch (e) {
            if (e.status === 401) {
                frappe.msgprint("OpenAI rejected the key (401). It has been cleared. Try again to re-enter it.");
                return "401";
            }
            if (!opts.silent) frappe.msgprint("AI draft failed: " + e.message);
            return "error";
        }

        if (out.status === "need_input") {
            if (!opts.silent)
                frappe.msgprint({
                    title: "Needs your input: " + this.esc(row.activity_name || row.idx),
                    message: this.esc(out.question || "Needs more information."),
                    indicator: "orange"
                });
            return { status: "need_input", question: out.question };
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
        frm.dirty();
        return "ok";
    },

    async draft_all_empty(frm) {
        const items = frm.doc.items || [];
        const targets = items.filter(
            (r) => !String(r.evaluation_text || "").trim() || !String(r.improvement_action || "").trim()
        );
        if (!targets.length) {
            frappe.msgprint("No empty activities. Nothing to draft.");
            return;
        }
        frappe.dom.freeze(`Drafting ${targets.length} activit${targets.length === 1 ? "y" : "ies"}...`);
        let drafted = 0;
        const skipped = [];
        try {
            for (const row of targets) {
                const r = await this.draft_row(frm, row.idx, { silent: true });
                if (r === "ok") drafted++;
                else if (r === "401") break;
                else if (r === "no-proc") { skipped.push({ a: row.activity_name, q: "No procedure set." }); break; }
                else if (r && r.status === "need_input") skipped.push({ a: row.activity_name, q: r.question });
                await new Promise((x) => setTimeout(x, 300));
            }
        } finally {
            frappe.dom.unfreeze();
        }
        this.render(frm);
        let msg = `Drafted ${drafted} of ${targets.length}.`;
        if (skipped.length)
            msg +=
                "<br><br><b>Needs your input:</b><ul>" +
                skipped.map((s) => `<li><b>${this.esc(s.a)}:</b> ${this.esc(s.q)}</li>`).join("") +
                "</ul>";
        msg += "<br>Nothing is saved yet. Review, then Save.";
        frappe.msgprint({ title: "AI Draft", message: msg, indicator: skipped.length ? "orange" : "green" });
    },

    // ---- grounding & model dialog ----
    open_grounding(frm) {
        const criterion = frm.doc.criterion;
        if (!criterion) {
            frappe.msgprint("This record has no Criterion set.");
            return;
        }
        const g = this.get_grounding(criterion);
        const self = this;
        const preset = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-5.4", "gpt-5.4-pro"];
        const saved_model = this.get_model();
        if (!preset.includes(saved_model)) preset.unshift(saved_model);
        const model_options = window._qmrModels && window._qmrModels.length ? window._qmrModels : preset;

        const d = new frappe.ui.Dialog({
            title: "Grounding & model for " + criterion,
            size: "large",
            fields: [
                { label: "Model", fieldname: "model", fieldtype: "Select", options: model_options.join("\n"), default: saved_model },
                { label: "Fetch available models", fieldname: "fetch_models", fieldtype: "Button" },
                {
                    label: "Self-check pass (reviews and corrects its own draft)",
                    fieldname: "self_check", fieldtype: "Check",
                    default: localStorage.getItem(self.SELFCHECK_LS) !== "false" ? 1 : 0
                },
                { fieldtype: "Section Break" },
                { label: "GD4 requirement (what EduTrust expects)", fieldname: "requirement", fieldtype: "Small Text", default: g.requirement },
                { label: "Google Doc link (optional)", fieldname: "drive_link", fieldtype: "Data", default: g.drive_link,
                  description: "Paste a Google Doc link, then Pull from Drive to load its text into Procedure." },
                { label: "Pull from Drive", fieldname: "pull_drive", fieldtype: "Button" },
                { label: "Procedure / SOP text (authoritative, required to draft)", fieldname: "procedure", fieldtype: "Small Text", default: g.procedure }
            ],
            primary_action_label: "Save grounding",
            primary_action(values) {
                self.save_grounding(criterion, {
                    requirement: values.requirement || "",
                    procedure: values.procedure || "",
                    drive_link: values.drive_link || ""
                });
                localStorage.setItem(self.MODEL_LS, values.model || "gpt-4o-mini");
                localStorage.setItem(self.SELFCHECK_LS, values.self_check ? "true" : "false");
                d.hide();
                frappe.show_alert({ message: "Grounding saved for " + criterion + ".", indicator: "green" });
                self.render(frm);
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
            if (!link) { frappe.msgprint("Paste a Google Doc link first."); return; }
            frappe.dom.freeze("Pulling from Drive...");
            try {
                const file_id = self.parse_drive_id(link);
                if (!file_id) throw new Error("Could not read a file id from that link.");
                const cid = await self.get_google_client_id();
                const token = await self.drive_token(cid);
                const text = await self.drive_fetch_text(token, file_id);
                d.set_value("procedure", text);
                frappe.show_alert({ message: `Pulled ${text.length} characters.`, indicator: "green" });
            } catch (e) {
                frappe.msgprint("Drive pull failed: " + e.message);
            } finally {
                frappe.dom.unfreeze();
            }
        });

        d.show();
    },

    // ---- plain-English step guide ----
    steps_html() {
        return `
<ol style="margin:0;padding-left:18px;line-height:1.7;font-size:13px;">
  <li><b>Set up once for this criterion.</b> Click <b>Grounding &amp; model</b> at the top. Paste two things:
      what the audit expects (the GD4 requirement) and how your college actually does it (the procedure or SOP).
      You can also paste a Google Doc link and click <b>Pull from Drive</b>. Click <b>Save grounding</b>.
      You only do this once per criterion; it is remembered on this computer.</li>
  <li><b>Say what happened.</b> If a result was below target, or nothing happened this period, type a short line
      in the record's <b>Overall Note</b> (near the top of the form) explaining why. The AI needs this so it can
      be honest rather than guess.</li>
  <li><b>Write the text.</b> Click <b>Draft</b> on any activity card to fill just that one, or <b>Draft all empty</b>
      to do every activity that is still blank. The first time, it asks for your OpenAI key (kept only for this
      browser session).</li>
  <li><b>Check, then save.</b> Read what it wrote in the Evaluation Text and Improvement Action boxes, edit anything
      you want, then click <b>Save</b>. Nothing is saved until you do.</li>
  <li><b>If it asks a question instead of writing:</b> that means it did not have enough to go on. Add the missing
      detail (usually to the Overall Note, or the procedure) and draft again. It will never make up facts, dates,
      or numbers.</li>
</ol>`;
    },
    how_to(frm) {
        const self = this;
        const hidden = localStorage.getItem(this.HIDE_TIPS_LS) === "true";
        const d = new frappe.ui.Dialog({
            title: "How to use AI Draft",
            size: "large",
            primary_action_label: hidden ? "Show the blue tip box again" : "Close",
            primary_action() {
                if (hidden) {
                    localStorage.removeItem(self.HIDE_TIPS_LS);
                    if (frm) self.render(frm);
                    frappe.show_alert({ message: "The tip box is back at the top of the form.", indicator: "green" });
                }
                d.hide();
            }
        });
        d.$body.html(this.steps_html());
        d.show();
    },
    tips_banner() {
        if (localStorage.getItem(this.HIDE_TIPS_LS) === "true") return "";
        return `
<div class="qmr-tips">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
    <b style="color:#1a3b6e;">First time here? Three quick steps:</b>
    <button class="qmr-btn" data-hidetips style="margin-left:auto;">Got it, hide this</button>
  </div>
  <ol style="margin:0;padding-left:18px;line-height:1.6;">
    <li><b>Grounding &amp; model</b> (top): paste the audit requirement and your procedure once per criterion.</li>
    <li>Type a short line in <b>Overall Note</b> if a target was missed or nothing happened.</li>
    <li>Click <b>Draft</b> on a card (or <b>Draft all empty</b>), then review and <b>Save</b>.</li>
  </ol>
  <div style="margin-top:5px;"><a href="#" data-howto style="font-size:12px;">See the full step by step</a></div>
</div>`;
    },

    // ---- render the inline editor with per-card Draft buttons ----
    render(frm) {
        const wrapper = frm.fields_dict.qmr_inline_editor.$wrapper;
        const items = frm.doc.items || [];
        const criterion = frm.doc.criterion || "";
        const has_proc = criterion && !!String(this.get_grounding(criterion).procedure || "").trim();
        const self = this;

        const css = `
<style>
  .qmr-card{border:1px solid #d8dee9;border-radius:6px;background:#fff;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.04);}
  .qmr-header{background:#f5f7fa;border-radius:6px 6px 0 0;padding:8px 12px;font-weight:600;color:#1a3b6e;font-size:13px;display:flex;align-items:center;gap:8px;}
  .qmr-header-planned{background:#eaf4ff;color:#1a3b6e;}
  .qmr-header-in-progress{background:#fff8e1;color:#8a6d00;}
  .qmr-header-completed{background:#e8f5e9;color:#2e7d32;}
  .qmr-header-deferred{background:#fdecea;color:#c62828;}
  .qmr-body{padding:12px 14px;}
  .section-h{color:#1a3b6e;font-weight:600;margin:12px 0 6px;font-size:13px;}
  .qmr-grid{display:flex;flex-wrap:wrap;gap:10px;}
  .qmr-col{flex:1 1 300px;min-width:250px;}
  .qmr-field label{display:block;font-weight:500;font-size:12px;color:#1a3b6e;margin-bottom:2px;}
  .qmr-input,textarea.qmr-input,select.qmr-input{width:100%;border:1px solid #ccd5e0;border-radius:4px;padding:6px;font-size:12.5px;background:#fff;}
  textarea.qmr-input{min-height:60px;resize:vertical;}
  .qmr-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#fff;border:1px solid #d8dee9;border-radius:6px;padding:8px 10px;margin-bottom:10px;}
  .qmr-btn{border:1px solid #1a3b6e;color:#1a3b6e;background:#fff;border-radius:4px;padding:5px 10px;font-size:12px;cursor:pointer;}
  .qmr-btn:hover{background:#eef2f8;}
  .qmr-btn.primary{background:#1a3b6e;color:#fff;}
  .qmr-draft{margin-left:auto;border:1px solid #1a3b6e;color:#1a3b6e;background:#fff;border-radius:4px;padding:3px 10px;font-size:11.5px;cursor:pointer;white-space:nowrap;}
  .qmr-draft:hover{background:#eef2f8;}
  .qmr-ground{font-size:12px;padding:2px 9px;border-radius:8px;}
  .qmr-ground-ok{background:#e8f5e9;color:#2e7d32;}
  .qmr-ground-no{background:#fff3e0;color:#e65100;}
  .qmr-muted{color:#777;font-size:12px;}
  .qmr-tips{background:#eef4ff;border:1px solid #c5d2ea;border-radius:6px;padding:10px 12px;margin-bottom:10px;font-size:12.5px;color:#24303f;}
</style>`;

        const toolbar = `
<div class="qmr-toolbar">
  <button class="qmr-btn primary" data-draftall title="Fill Evaluation Text and Improvement Action for every activity that is still blank in this record.">Draft all empty</button>
  <button class="qmr-btn" data-grounding title="Set, once per criterion, what the audit expects and how your college does it. The AI writes only from this, so it stays honest.">Grounding &amp; model</button>
  <button class="qmr-btn" data-howto title="A short step by step, in plain language.">How to use</button>
  <span class="qmr-ground ${has_proc ? "qmr-ground-ok" : "qmr-ground-no"}" title="${has_proc ? "A procedure is set for this criterion, so drafting is allowed." : "No procedure set yet. Click Grounding and model to add one before drafting."}">
    ${criterion ? (has_proc ? "Procedure loaded for " + this.esc(criterion) : "No procedure for " + this.esc(criterion) + " (drafting is blocked)") : "No Criterion on this record"}
  </span>
  <span class="qmr-muted">Model: ${this.esc(this.get_model())}</span>
</div>`;

        const banner = this.tips_banner();

        if (!items.length) {
            wrapper.html(css + banner + toolbar + `<div style="padding:10px;border:1px dashed #ccd5e0;border-radius:6px;background:#fafbfd;color:#7b7b7b;font-size:13px;">No activities yet. Load them from the Template and save, then draft here.</div>`);
            this.wire(frm, wrapper);
            return;
        }

        let html = css + banner + toolbar;
        items.forEach((row, i) => {
            html += `
<div class="qmr-card" data-idx="${row.idx}">
  <div class="qmr-header ${this.header_class(row.action_status)}">
    <span>#${i + 1}. ${this.esc(row.activity_name || "Untitled Activity")}</span>
    <button class="qmr-draft" data-draft="${row.idx}" title="Let the AI write this activity's KPI Target Description, Evaluation Text and Improvement Action, grounded in the procedure and the numbers. Review before saving.">Draft</button>
  </div>
  <div class="qmr-body">
    <div class="qmr-grid">
      <div class="qmr-col qmr-field"><label>Activity Name</label><input class="qmr-input" data-fn="activity_name" data-idx="${row.idx}" value="${this.esc(row.activity_name)}"></div>
      <div class="qmr-col qmr-field"><label>Feedback Source</label><input class="qmr-input" data-fn="feedback_source" data-idx="${row.idx}" value="${this.esc(row.feedback_source)}"></div>
      <div class="qmr-col qmr-field"><label>Frequency</label><select class="qmr-input" data-fn="frequency" data-idx="${row.idx}">${this.opt(this.FREQ, row.frequency)}</select></div>
      <div class="qmr-col qmr-field"><label>Timing</label><select class="qmr-input" data-fn="timing" data-idx="${row.idx}">${this.opt(this.TIMING, row.timing)}</select></div>
      <div class="qmr-col qmr-field"><label>Ownership</label><input class="qmr-input" data-fn="ownership" data-idx="${row.idx}" value="${this.esc(row.ownership)}"></div>
      <div class="qmr-col qmr-field"><label>KPI Metric</label><input class="qmr-input" data-fn="kpi_metric" data-idx="${row.idx}" value="${this.esc(row.kpi_metric)}"></div>
    </div>
    <div class="section-h">KPI Results and Evaluation</div>
    <div class="qmr-grid">
      <div class="qmr-col qmr-field"><label>KPI Target Value</label><input type="number" step="any" class="qmr-input" data-fn="kpi_target_value" data-idx="${row.idx}" value="${row.kpi_target_value ?? ""}"></div>
      <div class="qmr-col qmr-field"><label>KPI Actual Value</label><input type="number" step="any" class="qmr-input" data-fn="kpi_actual_value" data-idx="${row.idx}" value="${row.kpi_actual_value ?? ""}"></div>
      <div class="qmr-col qmr-field"><label>KPI UOM</label><input class="qmr-input" data-fn="uom" data-idx="${row.idx}" value="${this.esc(row.uom)}"></div>
      <div class="qmr-col qmr-field"><label>Action Status</label><select class="qmr-input" data-fn="action_status" data-idx="${row.idx}">${this.opt(this.ACTION, row.action_status)}</select></div>
    </div>
    <div class="qmr-field"><label>KPI Target Description</label><textarea class="qmr-input" data-fn="kpi_target_desc" data-idx="${row.idx}">${this.esc(row.kpi_target_desc)}</textarea></div>
    <div class="qmr-field"><label>&#11088; Evaluation Text</label><textarea class="qmr-input" data-fn="evaluation_text" data-idx="${row.idx}" placeholder="Describe results, trends, and analysis, grounded in the procedure and numbers...">${this.esc(row.evaluation_text)}</textarea></div>
    <div class="qmr-field"><label>&#128295; Improvement Action</label><textarea class="qmr-input" data-fn="improvement_action" data-idx="${row.idx}" placeholder="Maintain... or a Quality Action if below target...">${this.esc(row.improvement_action)}</textarea></div>
  </div>
</div>`;
        });

        wrapper.html(html);
        this.wire(frm, wrapper);
    },

    // ---- attach handlers once per render (off then on, no stacking) ----
    wire(frm, wrapper) {
        const self = this;
        const getRow = (idx) => (frm.doc.items || []).find((r) => String(r.idx) === String(idx));

        wrapper.off("change.qmr").on("change.qmr", "input, select, textarea", function () {
            const idx = $(this).data("idx"), fn = $(this).data("fn");
            const row = getRow(idx);
            if (!row || !fn) return;
            let val = $(this).val();
            if (fn === "kpi_target_value" || fn === "kpi_actual_value") val = val === "" ? null : parseFloat(val);
            row[fn] = val;
            frm.dirty();
        });

        wrapper.off("click.qmr").on("click.qmr", "[data-draft],[data-draftall],[data-grounding],[data-howto],[data-hidetips]", async function (e) {
            const $b = $(this);
            if ($b.is("[data-howto]")) { e.preventDefault(); self.how_to(frm); return; }
            if ($b.is("[data-hidetips]")) { localStorage.setItem(self.HIDE_TIPS_LS, "true"); self.render(frm); return; }
            if ($b.is("[data-grounding]")) { self.open_grounding(frm); return; }
            if ($b.is("[data-draftall]")) { self.draft_all_empty(frm); return; }
            const idx = $b.data("draft");
            const label = $b.text();
            $b.text("Drafting...").prop("disabled", true);
            try {
                const r = await self.draft_row(frm, idx);
                if (r === "ok") { self.render(frm); frappe.show_alert({ message: "Drafted activity #" + idx + ". Review, then Save.", indicator: "blue" }); }
            } finally {
                $b.text(label).prop("disabled", false);
            }
        });
    }
};
