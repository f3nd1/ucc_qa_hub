import type { Agent, Db } from "@/lib/qmr-engine";
import { clone } from "@/lib/qmr-engine";

/* =========================================================
   AGENT CONFIG

   Six agents to start, defined as data so they can be added, removed,
   or edited without code changes. Each specialist maps to engine
   functions via its id (see lib/agents/runners.ts). deskPosition and
   color are used by the 3D office in a later phase.
   ========================================================= */

/** Order in which the orchestrator invokes specialists. */
export const CANONICAL_ORDER = ["grounder", "drafter", "shortfall", "consistency", "signoff"] as const;

export const DEFAULT_AGENTS: Agent[] = [
  {
    id: "orchestrator",
    name: "Orchestrator",
    role: "You talk to it. It plans a run and invokes specialists in order, pausing for your accept.",
    systemPrompt:
      "You are the orchestrator for UCC's Quality Monitoring Record workflow. You plan which specialists to run over an activity, a record, or a cycle, and in what order. You never write audit text yourself and never finalise. AI recommends, humans decide: you surface each specialist's output for the user to accept or reject.",
    color: "#24508f",
    deskPosition: [0, 0, 0],
    enabled: true,
    scope: "record",
  },
  {
    id: "grounder",
    name: "Grounder",
    role: "Checks the GD4 requirement, procedure and evidence are present and sufficient before drafting.",
    systemPrompt:
      "You are the Grounder. For each activity you confirm the GD4 requirement and the UCC procedure are loaded and that there is evidence or a note giving a concrete basis to draft from. If a procedure is missing you block and ask for it. If there is no evidence or note you warn that the Drafter will refuse. You never invent facts.",
    color: "#2f8f8f",
    deskPosition: [-4, 0, -3],
    enabled: true,
    scope: "activity",
  },
  {
    id: "drafter",
    name: "Drafter",
    role: "Writes the Evaluation Text and Improvement Action, grounded, in house voice.",
    systemPrompt:
      "You are the Drafter. You write Evaluation Text and Improvement Action grounded in the GD4 requirement, the procedure, the evidence and the note, in UCC house voice, using the matching pattern's exemplars. If you cannot ground a claim you refuse and ask a precise question rather than inventing a sentence.",
    color: "#2a6cd6",
    deskPosition: [4, 0, -3],
    enabled: true,
    scope: "activity",
  },
  {
    id: "shortfall",
    name: "Shortfall Auditor",
    role: "Hunts below-target with a positive narrative, bare zeros without nil phrasing, placeholders, off-topic text.",
    systemPrompt:
      "You are the Shortfall Auditor. You specifically hunt for actual-below-target dressed up in a positive narrative, a bare zero that does not use the nil pattern, leftover placeholder text, and evaluations that read as copied from another activity. You report issues plainly; you do not soften a shortfall.",
    color: "#e0902a",
    deskPosition: [-4, 0, 3],
    enabled: true,
    scope: "record",
  },
  {
    id: "consistency",
    name: "Consistency Reviewer",
    role: "Harmonises tone across a record so evaluations read as one voice, facts unchanged.",
    systemPrompt:
      "You are the Consistency Reviewer. You harmonise tone, tense and phrasing across a record's evaluations so they read as one voice for an EduTrust audit. You keep every factual claim unchanged and grounded; you only adjust wording.",
    color: "#7e57c2",
    deskPosition: [4, 0, 3],
    enabled: true,
    scope: "record",
  },
  {
    id: "signoff",
    name: "Sign-off Auditor",
    role: "The final gate. Challenges the weakest evaluations, blocks finalising on blank or placeholder text.",
    systemPrompt:
      "You are the Sign-off Auditor, playing an EduTrust assessor. You challenge the weakest evaluations, block finalising any activity with blank or placeholder text, and record the reviewer and date on the ones the human approves. You never finalise on your own; the human decides.",
    color: "#2e8b57",
    deskPosition: [0, 0, 5],
    enabled: true,
    scope: "record",
  },
];

/** The runner behaviour an agent uses (kind falls back to id for built-ins). */
export function kindOf(a: Agent): string {
  return a.kind ?? a.id;
}

/** The five specialist behaviours a custom agent can reuse. */
export const AGENT_KINDS = CANONICAL_ORDER;

/** Effective agents: the user's edited config, or the defaults if none saved. */
export function getAgents(db: Db): Agent[] {
  return db.agents && db.agents.length ? db.agents : DEFAULT_AGENTS;
}

/** Persist an agent config (seeds from defaults on first edit). */
export function setAgents(db: Db, agents: Agent[]): Db {
  const d = clone(db);
  d.agents = agents;
  return d;
}

/** Toggle one agent enabled/disabled, seeding the config from defaults if empty. */
export function toggleAgent(db: Db, id: string): Db {
  return setAgents(
    db,
    getAgents(db).map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
  );
}

/** Patch one agent's fields. */
export function updateAgent(db: Db, id: string, patch: Partial<Agent>): Db {
  return setAgents(
    db,
    getAgents(db).map((a) => (a.id === id ? { ...a, ...patch } : a)),
  );
}

/** Remove an agent (the orchestrator cannot be removed). */
export function removeAgent(db: Db, id: string): Db {
  if (id === "orchestrator") return db;
  return setAgents(
    db,
    getAgents(db).filter((a) => a.id !== id),
  );
}

/** A desk position for the next agent, spread on a ring so desks do not overlap. */
export function nextDeskPosition(agents: Agent[]): [number, number, number] {
  const n = agents.filter((a) => a.id !== "orchestrator").length;
  const angle = (n / 6) * Math.PI * 2;
  return [Number((Math.sin(angle) * 5).toFixed(2)), 0, Number((-Math.cos(angle) * 4).toFixed(2))];
}

/** Add a new agent (a new desk). Caller supplies id/name/kind/color/scope. */
export function addAgent(db: Db, agent: Agent): Db {
  return setAgents(db, [...getAgents(db), agent]);
}
