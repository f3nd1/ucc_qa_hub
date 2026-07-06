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

## Set-up on the form

1. Open a Quality Monitoring Record. Click **Grounding & model** (top toolbar).
2. For this record's Criterion, paste the **Procedure/SOP** text (or paste a
   Google Doc link and click **Pull from Drive**). This is cached in your
   browser per criterion, so you only do it once per criterion. Optionally
   click **Fetch available models** to pick the OpenAI model. Save grounding.
3. Click **Draft** on a card (or **Draft all empty**). The first time, it asks
   for your OpenAI API key; it is held for the browser session only and cleared
   automatically if OpenAI rejects it.
4. Review the drafted text in the cards, then **Save** the form. Nothing is
   auto-saved.

## Rules kept (do not weaken)

- No procedure loaded for the criterion means it will not draft.
- If an activity has no concrete basis (for example a shortfall with no Overall
  Note explaining the cause), that activity refuses and asks a specific question
  instead of inventing text.

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
