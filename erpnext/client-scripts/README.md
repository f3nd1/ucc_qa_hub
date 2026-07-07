# ERPNext client scripts for Quality Monitoring Record

These are Frappe/ERPNext **Client Scripts** (Desk > Client Script), not part of
the Next.js app. They add grounded AI drafting straight into the Quality
Monitoring Record form, reusing the same prompts and grounded-or-refuse rule as
the QMR Agent Office app.

## What to install

**`quality-monitoring-record-inline-editor-ai.js`**
Paste this as the Script of your existing **"Quality Monitoring Record - User
Interface"** client script, replacing its content. It renders the activity
cards (as before) and adds:

- a **Draft** button on each activity card, and
- a **Draft all empty** button plus a **Grounding & model** button in a toolbar
  at the top.

The Draft buttons fill the activity's **KPI Target Description** (only if blank),
**Evaluation Text** and **Improvement Action**.

## Procedure source

The procedure/SOP text is **not** pasted or stored in the browser any more. It
is read live from the **Quality Procedure** DocType:

- The Quality Procedure record whose **`custom_criterion_reference`** field
  equals the Quality Monitoring Record's **Criterion** is the match.
- Its **`custom_ppd_text_format`** field is the authoritative procedure text
  used for grounding.
- If no Quality Procedure record matches a criterion, drafting is blocked for
  every activity under that criterion until one is created.

This makes the procedure a single, shared, governed source of truth (with
Frappe's normal permissions, ownership and version history) instead of a
per-browser paste that could drift between reviewers.

Anyone using this must have **read** permission on Quality Procedure, or the
lookup will silently return no match and drafting will refuse for that
criterion.

## Set-up on the form

1. Open a Quality Monitoring Record. Click **Grounding & model** (top toolbar)
   to confirm the matching Quality Procedure record was found and see its text.
   Use **Refresh from Quality Procedure** if you just edited that record, or
   **Open/Create Quality Procedure record** if none matches yet.
2. Optionally click **Fetch available models** to pick the OpenAI model, then
   **Save model settings**.
3. Click **Draft** on a card (or **Draft all empty**). The first time, it asks
   for your OpenAI API key; it is held for the browser session only and cleared
   automatically if OpenAI rejects it.
4. Review the drafted text in the cards, then **Save** the form. Nothing is
   auto-saved.

## Overall Note is shared, but scoped per activity

The DocType has one **Overall Note** field for the whole record, but each
activity can need its own separate explanation. To keep one activity's answer
from being read as grounding for a different activity:

- A line starting with `[Activity Name]` is used only when drafting that
  activity. The **Needs your input** answer dialog tags your answer this way
  automatically.
- A line with no `[...]` tag is treated as a general remark and is visible to
  every activity.
- When drafting activity A, anything tagged `[Activity B]` is left out
  entirely, so A's draft is never grounded in an explanation that was actually
  about B.

## Rules kept (do not weaken)

- No matching Quality Procedure record for the criterion means it will not draft.
- If an activity has no concrete basis (for example a shortfall, or an actual
  value of 0, with no note explaining the cause), that activity refuses and
  asks a specific question instead of inventing text. An actual of 0 against a
  positive target is never assumed to be benign; it needs the same note-backed
  explanation as any other shortfall.

## Other scripts on this DocType

- Keep your **"Childtable Clone"** (template) client script as it is; it loads
  activities from the Template and is unrelated to drafting.
- If you had the earlier standalone "AI Draft" client script, **disable or
  delete it** so only the inline editor above runs.

## Note

These could not be run against a live Frappe/ERPNext instance in development
(none was available). They are syntax-checked and written against the DocType
schema and field names as provided; test on a dev/staging site before
production.
