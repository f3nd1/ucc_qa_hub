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

## Status: Phase 2 — agent layer (flat UI)

Phase 1 ported the proven engine from the single-file tool
(`qmr-workbench.html`) into a framework-agnostic TypeScript module
(`lib/qmr-engine/`). Phase 2 adds the six-agent config, the orchestrator, and a
sequential runner, still in a flat 2D UI. No 3D yet (that is Phase 3).

Engine (Phase 1):

- Data model (cycles, records, items, procedures, GD4 requirements, drive links,
  exemplars, note bank).
- Grounding + refuse-when-ungrounded: a client-side gate (no procedure = block,
  no API call) and a model-side `need_input` refusal.
- Pattern detection (met / nil / shortfall) and the deterministic checks.
- AI drafting with self-check, plus the whole-record consistency pass.
- Review / sign-off gate (blocks Final on blank or placeholder text).
- Exports: flat CSV, ERPNext Data Import CSV, project JSON, Supabase migration SQL.

Agents (Phase 2), in `lib/agents/`:

- Six agents defined as data (`Agent` config): Orchestrator, Grounder, Drafter,
  Shortfall Auditor, Consistency Reviewer, Sign-off Auditor. The config lives in
  the project file (`db.agents`) and can be added to or edited without code.
- Each specialist maps to engine functions: Grounder → grounding gate;
  Drafter → aiDraft; Shortfall → rowChecks; Consistency → consistencyPass;
  Sign-off → finalise gate + critique weakest point.
- The orchestrator plans a run and invokes specialists in sequence. Every step
  is surfaced for human accept or reject. Nothing is applied until you accept.
  AI recommends, humans decide.

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

### Run the orchestrator (no API key needed to see the flow)

1. **Load demo**, then open the **Agent office** tab.
2. Pick a record (for example `UCC-QMR-250006`), leave the instruction blank, and
   press **Plan run**. The plan is Grounder → Drafter → Shortfall Auditor →
   Consistency Reviewer → Sign-off Auditor.
3. Press **Start run** and step through. Deterministic specialists (Grounder,
   Shortfall, Sign-off) work offline; Drafter and Consistency report that they
   need a key. Accept the Sign-off step to finalise the record's ready activities.

A free-text instruction narrows the plan by keyword (e.g. "just draft", "check
for shortfalls", "finalise"). Disabling an agent in the roster removes it from
the plan.

### Then test a real grounded draft

Open **Settings**, paste a spend-capped OpenAI key, save, then press **Draft this
activity** on a blank activity (for example the orientation activity in 250017),
or run the orchestrator so the Drafter and Consistency Reviewer call the model.

## Layout

```
app/                     routes, layout
components/phase1/        flat records editor + shell (tabs live here)
components/phase2/        agent office: orchestrator, roster, run steps
lib/qmr-engine/           ported engine: data model, grounding, checks, ai, io
lib/agents/               agent config + orchestrator + specialist runners
lib/store/                storage adapter seam (localStorage now, Supabase later)
supabase/migrations/      schema (incl. qmr_agents)
```

## Conventions

UK/British spelling. No em dashes. "teacher" not instructor. "Quality Action"
not corrective action plan. See `CLAUDE.md` for the full house style and rules.
