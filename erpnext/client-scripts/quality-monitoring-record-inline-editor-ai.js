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
//   - Each draft is grounded in this criterion's UCC procedure, read live from
//     the "Quality Procedure" DocType: the record whose custom_criterion_reference
//     equals this record's Criterion, using its custom_ppd_text_format field as
//     the authoritative SOP text. Click "Grounding & model" to check it, or to
//     open/create that record if none matches.
//   - No matching Quality Procedure record means it will not draft. If an
//     activity has no concrete basis (for example a shortfall with no Overall
//     Note explaining the cause), that activity refuses and asks a question
//     instead of inventing.
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
    HIDE_TIPS_LS: "qmr_ai_hide_tips",

    PROC_DOCTYPE: "Quality Procedure",
    PROC_MATCH_FIELD: "custom_criterion_reference",
    PROC_TEXT_FIELD: "custom_ppd_text_format",
    _procCache: {},

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
    // Strip ALL whitespace, not just leading/trailing: API keys never legitimately
    // contain whitespace, and a stray newline (easy to embed by accident in a
    // multi-line Text field, e.g. an extra Enter or a paste with a line break)
    // makes fetch() throw "Invalid value" when it is used in an Authorization
    // header, since header values cannot contain control characters. Also strips
    // zero-width and other invisible Unicode characters that \s does not match
    // (common when a key is copied out of Notion/Slack/Google Docs) and that
    // OpenAI would otherwise silently reject as part of the key, showing up as
    // a plain 401 with no obvious cause.
    clean_key(v) {
        // 0x200B-0x200F: zero-width space/joiners, LTR/RTL marks
        // 0x2060: word joiner, 0xFEFF: byte order mark, 0x00AD: soft hyphen
        const invisible = [0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2060, 0xfeff, 0x00ad]
            .map((code) => String.fromCharCode(code))
            .join("");
        const pattern = new RegExp("[\\s" + invisible + "]+", "g");
        return String(v || "").replace(pattern, "");
    },
    get_key() {
        if (!window._qmrKey) window._qmrKey = this.clean_key(sessionStorage.getItem(this.KEY_SS));
        if (window._qmrKey) return Promise.resolve(window._qmrKey);
        return new Promise((resolve) => {
            frappe.prompt(
                { label: "OpenAI API Key", fieldname: "key", fieldtype: "Text", reqd: 1 },
                (v) => {
                    window._qmrKey = this.clean_key(v.key);
                    sessionStorage.setItem(this.KEY_SS, window._qmrKey);
                    resolve(window._qmrKey);
                },
                "Enter API Key"
            );
        });
    },

    // ---- procedure: fetched live from the Quality Procedure DocType ----
    // Matched by PROC_MATCH_FIELD (custom_criterion_reference) = this record's
    // Criterion; the authoritative SOP text is PROC_TEXT_FIELD (custom_ppd_text_format).
    // Cached in memory only for this page load, not localStorage, so every
    // fresh visit reads the current, single, shared source of truth.
    async get_procedure(criterion, opts) {
        opts = opts || {};
        if (!opts.refresh && this._procCache[criterion]) return this._procCache[criterion];
        let result = { text: "", name: null };
        try {
            // Only fetch the docname from the list query. Asking a list query for a
            // second field can come back blank if that field has any field-level
            // permission restriction, even when the record itself matched, so the
            // procedure text is read from a full document fetch instead, below.
            const list = await frappe.db.get_list(this.PROC_DOCTYPE, {
                filters: { [this.PROC_MATCH_FIELD]: criterion },
                fields: ["name"],
                limit: 1
            });
            if (list && list.length) {
                const name = list[0].name;
                // frappe.client.get (whitelisted on every Frappe version) fetches the
                // whole document, which is not subject to the same field selection
                // restrictions a list query can silently apply.
                const r = await frappe.call({ method: "frappe.client.get", args: { doctype: this.PROC_DOCTYPE, name } });
                const doc = r && r.message;
                result = { text: this.strip((doc && doc[this.PROC_TEXT_FIELD]) || ""), name };
            }
        } catch (e) {
            console.warn("Could not load Quality Procedure:", e.message);
        }
        this._procCache[criterion] = result;
        return result;
    },
    no_procedure_message(criterion, proc) {
        return proc.name
            ? "The Quality Procedure record " + proc.name + " was found for criterion '" + criterion +
              "', but its procedure text field (" + this.PROC_TEXT_FIELD + ") is empty. Fill it in on that record."
            : "No Quality Procedure record found for criterion '" + criterion +
              "'. Click 'Grounding & model' to check or create one.";
    },

    // ---- OpenAI ----
    async fetch_models(key) {
        const res = await fetch("https://api.openai.com/v1/models", {
            headers: { Authorization: `Bearer ${this.clean_key(key)}` }
        });
        if (!res.ok) {
            if (res.status === 401) this.clear_key();
            let detail = "";
            try {
                const err = await res.json();
                detail = err.error && err.error.message ? err.error.message : "";
            } catch (e) {}
            throw new Error(`OpenAI ${res.status}${detail ? ": " + detail : ""}`);
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
            headers: { Authorization: `Bearer ${this.clean_key(key)}`, "Content-Type": "application/json" },
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
            "You are given, in priority order: the PROCEDURE (how UCC does it, authoritative for steps and evidence), the activity details, the KPI target and actual, and an OVERALL NOTE describing what happened this period.",
            "",
            "GROUNDING RULES (critical):",
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
        const proc = await this.get_procedure(criterion);
        if (!proc.text) {
            if (!opts.silent) {
                frappe.msgprint(this.no_procedure_message(criterion, proc));
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
            procedure: proc.text,
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
                if (!opts.silent)
                    frappe.msgprint(
                        "OpenAI rejected the key (401" + (e.message ? ": " + e.message.replace(/^OpenAI 401:\s*/, "") : "") +
                        "). It has been cleared. Click Draft again to re-enter it."
                    );
                return "401";
            }
            if (/Invalid value/.test(e.message || "")) {
                this.clear_key();
                if (!opts.silent)
                    frappe.msgprint(
                        "Your OpenAI key had a stray space or line break in it, which the browser rejects. " +
                        "It has been cleared; click Draft again and re-enter it on one line."
                    );
                return "error";
            }
            if (!opts.silent) frappe.msgprint("AI draft failed: " + e.message);
            return "error";
        }

        if (out.status === "need_input") {
            // No msgprint here: the caller decides how to present this. Both the
            // per-card Draft button and the "Draft all empty" loop open the same
            // ask_and_redraft() dialog, one activity at a time.
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

    // ---- answer box for a "need_input" refusal, then redraft that activity ----
    // Returns a Promise that resolves once this activity is settled: "ok",
    // "error", "401", or "skipped" (user chose not to answer). Used by both the
    // per-card Draft button and, one at a time, by draft_all_empty, so a bulk
    // run pauses on each question instead of only surfacing it once at the end.
    ask_and_redraft(frm, idx, activity_name, question, opts) {
        opts = opts || {};
        const self = this;
        return new Promise((resolve) => {
            let programmatic = false;
            const d = new frappe.ui.Dialog({
                title: "Needs your input: " + (activity_name || "activity #" + idx),
                fields: [
                    {
                        fieldtype: "HTML", fieldname: "q_html",
                        options: `<div style="margin-bottom:10px;color:#1a3b6e;">${self.esc(question || "Needs more information.")}</div>`
                    },
                    { label: "Your answer", fieldname: "answer", fieldtype: "Small Text", reqd: 1 }
                ],
                primary_action_label: "Add to Overall Note and redraft",
                secondary_action_label: "Skip this activity",
                secondary_action() {
                    programmatic = true;
                    d.hide();
                    resolve("skipped");
                },
                async primary_action(values) {
                    const answer = String(values.answer || "").trim();
                    if (!answer) return;
                    d.get_primary_btn().prop("disabled", true).text("Redrafting...");
                    const prefix = activity_name ? "[" + activity_name + "] " : "";
                    const existing = String(frm.doc.overall_note || "").trim();
                    const updated = existing ? existing + "\n" + prefix + answer : prefix + answer;
                    await frm.set_value("overall_note", updated);
                    programmatic = true;
                    d.hide();
                    const r = await self.draft_row(frm, idx, opts);
                    if (r && r.status === "need_input") {
                        resolve(await self.ask_and_redraft(frm, idx, activity_name, r.question, opts));
                    } else {
                        resolve(r);
                    }
                }
            });
            // If the user closes the dialog without answering or skipping
            // (X button, backdrop click), treat it the same as Skip so a bulk
            // run does not hang forever waiting for a decision.
            d.$wrapper.on("hidden.bs.modal", () => { if (!programmatic) resolve("skipped"); });
            d.show();
        });
    },

    async draft_all_empty(frm) {
        const self = this;
        const items = frm.doc.items || [];
        const targets = items.filter(
            (r) => !String(r.evaluation_text || "").trim() || !String(r.improvement_action || "").trim()
        );
        if (!targets.length) {
            frappe.msgprint("No empty activities. Nothing to draft.");
            return;
        }

        // Fail fast on the two things that would otherwise freeze then error.
        const criterion = frm.doc.criterion;
        if (!criterion) { frappe.msgprint("This record has no Criterion set."); return; }
        const proc = await this.get_procedure(criterion);
        if (!proc.text) {
            frappe.msgprint(this.no_procedure_message(criterion, proc));
            this.open_grounding(frm);
            return;
        }
        // Prompt for the key BEFORE showing the progress dialog, so it is never
        // hidden behind an overlay.
        const key = await this.get_key();
        if (!key) return;

        const prog = this.progress_dialog(targets.length);
        let drafted = 0;
        const skipped = [];
        let cancelled = false;
        prog.on_cancel(() => { cancelled = true; });
        try {
            for (let i = 0; i < targets.length; i++) {
                if (cancelled) break;
                const row = targets[i];
                prog.step(i, row.activity_name);
                let r = await this.draft_row(frm, row.idx, { silent: true });
                if (r && r.status === "need_input") {
                    prog.waiting(row.activity_name, r.question);
                    r = await this.ask_and_redraft(frm, row.idx, row.activity_name, r.question, { silent: true });
                }
                if (r === "ok") { drafted++; prog.result(row.activity_name, "ok"); }
                else if (r === "401") { prog.result(row.activity_name, "401"); break; }
                else if (r === "no-proc") { skipped.push({ a: row.activity_name, q: "No procedure set." }); prog.result(row.activity_name, "no-proc"); break; }
                else if (r === "skipped") { skipped.push({ a: row.activity_name, q: "Skipped." }); prog.result(row.activity_name, "skipped"); }
                else { prog.result(row.activity_name, "error"); }
                await new Promise((x) => setTimeout(x, 300));
            }
        } finally {
            this.render(frm);
            let summary = `Drafted ${drafted} of ${targets.length}${cancelled ? " (stopped early)" : ""}.`;
            if (skipped.length)
                summary +=
                    " <b>Skipped:</b><ul style='margin:6px 0 0;padding-left:18px;'>" +
                    skipped.map((s) => `<li><b>${this.esc(s.a)}:</b> ${this.esc(s.q)}</li>`).join("") +
                    "</ul><div style='margin-top:4px;'>Click <b>Draft</b> on each of those cards to try again.</div>";
            summary += "<div style='margin-top:6px;'>Nothing is saved yet. Review, then Save.</div>";
            prog.finish(summary, skipped.length ? "orange" : "green");
        }
    },

    // ---- live progress dialog for "Draft all empty" ----
    progress_dialog(total) {
        const self = this;
        const d = new frappe.ui.Dialog({ title: "Drafting activities", size: "large" });
        d.$body.html(`
<div style="font-size:13px;">
  <div style="background:#eef2f8;border-radius:6px;height:12px;overflow:hidden;margin-bottom:4px;">
    <div class="qmr-pbar" style="background:#1a3b6e;height:100%;width:0%;transition:width .3s;"></div>
  </div>
  <div class="qmr-pcount" style="text-align:right;color:#777;font-size:11.5px;margin-bottom:8px;">0 of ${total}</div>
  <div class="qmr-pcurrent" style="margin-bottom:8px;color:#1a3b6e;font-weight:600;">Starting...</div>
  <ol class="qmr-plog" style="margin:0;padding-left:20px;line-height:1.8;max-height:240px;overflow:auto;"></ol>
  <div class="qmr-psummary" style="margin-top:10px;"></div>
</div>`);
        // Only a Cancel/Close button; hide the header X so it cannot be dismissed
        // mid-run and leave the loop running invisibly.
        d.$wrapper.find(".modal-header .btn-modal-close, .modal-header .close").hide();
        let onCancel = null;
        d.set_primary_action("Stop", () => {
            if (onCancel) onCancel();
            d.get_primary_btn().prop("disabled", true).text("Stopping...");
        });
        d.show();

        const $bar = d.$body.find(".qmr-pbar");
        const $count = d.$body.find(".qmr-pcount");
        const $current = d.$body.find(".qmr-pcurrent");
        const $log = d.$body.find(".qmr-plog");
        const label = {
            ok: (n) => `<li style="color:#2e7d32;">&#10003; <b>${self.esc(n)}</b> drafted</li>`,
            need_input: (n, q) => `<li style="color:#e65100;">&#9873; <b>${self.esc(n)}</b> needs input: ${self.esc(q || "")}</li>`,
            skipped: (n) => `<li style="color:#8a6d00;">&#8709; <b>${self.esc(n)}</b> skipped</li>`,
            error: (n) => `<li style="color:#c62828;">&#10007; <b>${self.esc(n)}</b> could not be drafted</li>`,
            "no-proc": (n) => `<li style="color:#c62828;">&#10007; <b>${self.esc(n)}</b> stopped: no procedure set</li>`,
            "401": (n) => `<li style="color:#c62828;">&#10007; <b>${self.esc(n)}</b> stopped: OpenAI rejected the key</li>`
        };

        return {
            step(i, name) {
                $count.text(`${i} of ${total}`);
                $bar.css("width", Math.round((i / total) * 100) + "%");
                $current.html(`Drafting ${i + 1} of ${total}: <span style="font-weight:400;">${self.esc(name || "activity")}</span> &nbsp;<span style="color:#999;font-weight:400;">(waiting for the AI...)</span>`);
            },
            waiting(name, question) {
                $current.html(
                    `<span style="color:#e65100;">&#9873; Needs your input for ${self.esc(name || "this activity")}:</span> ` +
                    `<span style="font-weight:400;">${self.esc(question || "")}</span>`
                );
            },
            result(name, status, q) {
                const fn = label[status] || label.error;
                $log.append(fn(name, q));
                $log.scrollTop($log[0].scrollHeight);
            },
            on_cancel(fn) { onCancel = fn; },
            finish(summaryHtml, indicator) {
                $bar.css("width", "100%");
                $count.text(`${total} of ${total}`);
                $current.html('<span style="color:#2e7d32;">&#10003; Done. Review the drafts below, then Save the form.</span>');
                const colour = indicator === "orange" ? "#e65100" : "#2e7d32";
                d.$body.find(".qmr-psummary").html(`<div style="border-top:1px solid #e5e9f0;padding-top:8px;color:${colour};">${summaryHtml}</div>`);
                d.get_primary_btn().prop("disabled", false).text("Close").off("click").on("click", () => d.hide());
                d.$wrapper.find(".modal-header .btn-modal-close, .modal-header .close").show();
            }
        };
    },

    // ---- grounding & model dialog ----
    async open_grounding(frm) {
        const criterion = frm.doc.criterion;
        if (!criterion) {
            frappe.msgprint("This record has no Criterion set.");
            return;
        }
        const self = this;
        const preset = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-5.4", "gpt-5.4-pro"];
        const saved_model = this.get_model();
        if (!preset.includes(saved_model)) preset.unshift(saved_model);
        const model_options = window._qmrModels && window._qmrModels.length ? window._qmrModels : preset;
        const proc = await this.get_procedure(criterion);

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
                { fieldtype: "Section Break", label: "Procedure (from Quality Procedure)" },
                {
                    label: proc.name ? "Loaded from Quality Procedure " + proc.name : "No matching Quality Procedure record",
                    fieldname: "procedure", fieldtype: "Small Text", read_only: 1,
                    default: proc.text || "(none found for this criterion)"
                },
                { label: "Refresh from Quality Procedure", fieldname: "refresh_proc", fieldtype: "Button" },
                { label: proc.name ? "Open Quality Procedure record" : "Create Quality Procedure record", fieldname: "open_proc", fieldtype: "Button" }
            ],
            primary_action_label: "Save model settings",
            primary_action(values) {
                localStorage.setItem(self.MODEL_LS, values.model || "gpt-4o-mini");
                localStorage.setItem(self.SELFCHECK_LS, values.self_check ? "true" : "false");
                d.hide();
                frappe.show_alert({ message: "Model settings saved.", indicator: "green" });
                self.render(frm);
            }
        });

        d.fields_dict.fetch_models.$input.on("click", async () => {
            const key = await self.get_key();
            if (!key) return;
            const $btn = d.fields_dict.fetch_models.$input;
            const orig = $btn.text();
            $btn.text("Fetching...").prop("disabled", true);
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
                $btn.text(orig).prop("disabled", false);
            }
        });

        d.fields_dict.refresh_proc.$input.on("click", async () => {
            const $btn = d.fields_dict.refresh_proc.$input;
            const orig = $btn.text();
            $btn.text("Refreshing...").prop("disabled", true);
            try {
                const fresh = await self.get_procedure(criterion, { refresh: true });
                d.set_value("procedure", fresh.text || "(none found for this criterion)");
                d.set_df_property(
                    "procedure", "label",
                    fresh.name ? "Loaded from Quality Procedure " + fresh.name : "No matching Quality Procedure record"
                );
                d.set_df_property("open_proc", "label", fresh.name ? "Open Quality Procedure record" : "Create Quality Procedure record");
                frappe.show_alert({ message: fresh.text ? "Procedure refreshed." : "Still no matching record.", indicator: fresh.text ? "green" : "orange" });
                self.render(frm);
            } finally {
                $btn.text(orig).prop("disabled", false);
            }
        });

        d.fields_dict.open_proc.$input.on("click", () => {
            d.hide();
            const latest = self._procCache[criterion];
            if (latest && latest.name) {
                frappe.set_route("Form", self.PROC_DOCTYPE, latest.name);
            } else {
                frappe.new_doc(self.PROC_DOCTYPE, { [self.PROC_MATCH_FIELD]: criterion });
            }
        });

        d.show();
    },

    // ---- plain-English step guide ----
    steps_html() {
        return `
<ol style="margin:0;padding-left:18px;line-height:1.7;font-size:13px;">
  <li><b>Make sure the procedure exists.</b> The procedure text comes automatically from the <b>Quality
      Procedure</b> record for this criterion. Click <b>Grounding &amp; model</b> to check it is loaded, or to
      open/create that record if it is missing. There is nothing to paste here any more.</li>
  <li><b>Say what happened.</b> If a result was below target, or nothing happened this period, type a short line
      in the record's <b>Overall Note</b> (near the top of the form) explaining why. The AI needs this so it can
      be honest rather than guess.</li>
  <li><b>Write the text.</b> Click <b>Draft</b> on any activity card to fill just that one, or <b>Draft all empty</b>
      to do every activity that is still blank. The first time, it asks for your OpenAI key (kept only for this
      browser session).</li>
  <li><b>Check, then save.</b> Read what it wrote in the Evaluation Text and Improvement Action boxes, edit anything
      you want, then click <b>Save</b>. Nothing is saved until you do.</li>
  <li><b>If it asks a question instead of writing:</b> that means it did not have enough to go on. A box appears
      with the question and a place to type your answer; submitting it adds your answer to the record's Overall
      Note and drafts that activity again automatically. With <b>Draft all empty</b>, this happens one activity at
      a time, so it will pause and ask for each one that needs it (you can also click <b>Skip this activity</b>
      to move on without answering). It will never make up facts, dates, or numbers.</li>
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
    <li><b>Grounding &amp; model</b> (top): confirm the Quality Procedure record for this criterion is loaded.</li>
    <li>Type a short line in <b>Overall Note</b> if a target was missed or nothing happened.</li>
    <li>Click <b>Draft</b> on a card (or <b>Draft all empty</b>), then review and <b>Save</b>.</li>
  </ol>
  <div style="margin-top:5px;"><a href="#" data-howto style="font-size:12px;">See the full step by step</a></div>
</div>`;
    },

    // ---- render the inline editor with per-card Draft buttons ----
    async render(frm) {
        const wrapper = frm.fields_dict.qmr_inline_editor.$wrapper;
        const items = frm.doc.items || [];
        const criterion = frm.doc.criterion || "";
        const proc = criterion ? await this.get_procedure(criterion) : { text: "", name: null };
        const has_proc = !!proc.text;
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
  <button class="qmr-btn primary" data-draftall title="Fill Evaluation Text and Improvement Action for every activity that is still blank in this record. If one needs more information, it will ask you, one activity at a time.">Draft all empty</button>
  <button class="qmr-btn" data-grounding title="Check the procedure loaded from the Quality Procedure record for this criterion, and pick the AI model. The AI writes only from that procedure, so it stays honest.">Grounding &amp; model</button>
  <button class="qmr-btn" data-howto title="A short step by step, in plain language.">How to use</button>
  <span class="qmr-ground ${has_proc ? "qmr-ground-ok" : "qmr-ground-no"}" title="${criterion ? (has_proc ? "Loaded from Quality Procedure " + this.esc(proc.name) + "." : this.esc(this.no_procedure_message(criterion, proc))) : ""}">
    ${criterion
        ? (has_proc
            ? "Procedure loaded for " + this.esc(criterion)
            : (proc.name
                ? "Quality Procedure " + this.esc(proc.name) + " has no procedure text (drafting is blocked)"
                : "No Quality Procedure for " + this.esc(criterion) + " (drafting is blocked)"))
        : "No Criterion on this record"}
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
                let r = await self.draft_row(frm, idx);
                if (r && r.status === "need_input") {
                    const row = getRow(idx);
                    $b.text("Needs input...");
                    r = await self.ask_and_redraft(frm, idx, row && row.activity_name, r.question);
                }
                if (r === "ok") { self.render(frm); frappe.show_alert({ message: "Drafted activity #" + idx + ". Review, then Save.", indicator: "blue" }); }
                else if (r === "skipped") { frappe.show_alert({ message: "Skipped.", indicator: "orange" }); }
            } finally {
                $b.text(label).prop("disabled", false);
            }
        });
    }
};
