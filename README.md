# QMR Agent Office

A walk-around office interface for United Ceres College (UCC) Quality Monitoring
Records (QMR), for EduTrust GD4 audit preparation. An orchestrator plus
configurable specialist agents help fill, draft, check, and sign off records
across all GD4 criteria.

**Principle: AI recommends, humans decide.** No agent auto-finalises. Every AI
output is a draft requiring human acceptance.

**The rule that matters most: grounded or refuse.** Audit text must be grounded
in (priority order) the GD4 requirement, the UCC procedure, the evidence, and
the user's note. If a claim cannot be grounded, the tool refuses and asks a
precise question rather than inventing a plausible sentence.

## Status: Phase 1 — ported engine

This phase ports the proven engine from the single-file tool
(`qmr-workbench.html`) into a framework-agnostic TypeScript module
(`lib/qmr-engine/`) and proves it against the demo data with a plain flat page.
No 3D and no agent layer yet (those are Phases 2–4).

What works:

- Data model (cycles, records, items, procedures, GD4 requirements, drive links,
  exemplars, note bank).
- Grounding + refuse-when-ungrounded: a client-side gate (no procedure = block,
  no API call) and a model-side `need_input` refusal.
- Pattern detection (met / nil / shortfall) and the deterministic checks.
- AI drafting with self-check, plus the whole-record consistency pass.
- Review / sign-off gate (blocks Final on blank or placeholder text).
- Exports: flat CSV, ERPNext Data Import CSV, project JSON, Supabase migration SQL.

Stubbed until a later phase: file extraction (`extract.ts`, docx/pdf) and
ERPNext read/write-back (`erpnext.ts`).

## Run it

```bash
pnpm install
pnpm dev
# open http://localhost:3000
```

### Prove Phase 1 with no API key

1. Press **Load demo** — three records appear (250017 blank to draft, 250006 with
   shortfall flags, 250012 already drafted with critique and a signed-off row).
2. On any record press **Clear procedure**, then **Draft this activity**. The
   draft is blocked with a precise question and no network call is made. This is
   the refuse rule.
3. Press **Restore demo procedure** to put it back.

### Then test a real grounded draft

Open **Settings**, paste a spend-capped OpenAI key, save, then press **Draft this
activity** on a blank activity (for example the orientation activity in 250017).

## Layout

```
app/                     routes, layout
components/phase1/        the flat proving UI (replaced/extended in later phases)
lib/qmr-engine/           ported engine: data model, grounding, checks, ai, io
lib/store/                storage adapter seam (localStorage now, Supabase later)
supabase/migrations/      schema
```

## Conventions

UK/British spelling. No em dashes. "teacher" not instructor. "Quality Action"
not corrective action plan. See `CLAUDE.md` for the full house style and rules.
