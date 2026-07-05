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

## Status: Phase 4 — polish + config

Phase 1 ported the proven engine (`lib/qmr-engine/`); Phase 2 added the six-agent
config, orchestrator, and sequential runner (`lib/agents/`); Phase 3 wrapped it in
a walk-around 3D office. Phase 4 surfaces the rest of the workflow in that office
and does a reduced-motion / performance pass. The engine is unchanged: nothing
about grounding or the refuse rule moves.

The 3D office (`components/office/`, `components/windows/`):

- A room you orbit, pan and zoom. Orchestrator dais in the centre; one desk per
  agent around it, each with a light in the agent's colour (a disabled agent's
  desk dims). A records shelf on the back wall shows a tile per record, coloured
  by status (to fill / filled / flagged / final).
- Clicking the dais, a desk, or a shelf tile opens the matching panel in an
  OS-style draggable window over the canvas (DOM overlay, not 3D geometry).
- Flat mode is always one click away (top-right toggle) and is the exact Phase
  1/2 UI. The choice is remembered; reduced-motion users default to flat, and in
  3D reduced-motion disables control damping. The 3D bundle (three.js) is
  code-split, so flat mode never loads it, and the canvas renders on demand
  (only when something changes) rather than every frame.

Phase 4 config windows, opened from the topbar:

- **Configure agents:** add, remove, and edit agents (name, colour, scope,
  behaviour, desk position, enabled, grounding brief). Adding one adds a desk;
  removing one removes it. A custom agent picks a `kind` to reuse one of the five
  specialist behaviours. Config persists in `db.agents`.
- **Cycles:** switch, create (with carry-forward seeding from a prior cycle),
  rename, delete. The topbar pill shows the active cycle.
- **Filters:** two-level GD4 (main → sub), department, action status, review
  state. The filtered set drives which tiles appear on the shelf.
- **Sign-off:** review-state summary, the weakest points an auditor would
  challenge, and a bulk finalise of everything already Under Review (still
  blocked on blank or placeholder text).

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

File extraction (`extract.ts`) is wired: the criterion library can pull GD4
requirements and procedures out of Word (`.docx` via mammoth), PDF (`.pdf` via
pdf.js), or `.txt` / `.md`. The libraries are dynamically imported (out of the
main bundle) and the pdf.js worker is served from `public/` (copied on
postinstall), so extraction runs entirely offline, no CDN.

Stubbed until a later phase: ERPNext read/write-back (`erpnext.ts`), the Supabase
adapter, and Google Drive.

## Run it

```bash
pnpm install
pnpm dev
# open http://localhost:3000
```

It opens into the **3D office**. Drag to orbit, scroll to zoom, and click the
centre dais, a desk, or a shelf tile to open its panel in a draggable window.
Use **Flat mode** (top-right) for the plain 2D UI at any time.

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
components/AppShell       top-level: 3D / flat mode + shared toast
components/office/        the 3D office: scene, dais, desks, shelf, panels
components/windows/       draggable window
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
