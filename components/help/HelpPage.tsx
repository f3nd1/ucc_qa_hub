import type { ReactNode } from "react";

const item: React.CSSProperties = { marginBottom: 12 };
const term: React.CSSProperties = { fontWeight: 600, color: "var(--navy)", fontSize: 12.8 };
const desc: React.CSSProperties = { fontSize: 12.5, color: "var(--ink)", lineHeight: 1.55, marginTop: 2 };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h4 style={{ color: "var(--navy)", fontSize: 13, margin: "0 0 10px", borderBottom: "1px solid var(--border-light)", paddingBottom: 6 }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

function Item({ term: t, children }: { term: string; children: ReactNode }) {
  return (
    <div style={item}>
      <div style={term}>{t}</div>
      <div style={desc}>{children}</div>
    </div>
  );
}

/** Plain-English explanation of every control in the workbench. One page,
    reused from the topbar in both the flat view and the 3D office. */
export function HelpPage() {
  return (
    <div style={{ maxWidth: 720, fontSize: 12.5 }}>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        The one rule that runs through everything below: <b>AI recommends, humans decide.</b> No button here ever
        auto-finalises a record. Where the AI does not have enough to go on, it refuses and asks a precise
        question rather than inventing a plausible-sounding sentence.
      </p>

      <Section title="Drafting an activity">
        <Item term="Draft">
          Asks the AI to write the Evaluation Text and Improvement Action for this one activity, grounded in the
          GD4 requirement, the UCC procedure, the KPI numbers, and your note or evidence. If it does not have
          enough to work with — no procedure loaded, or no note/evidence to explain an ambiguous number — it
          refuses and asks you a specific question instead of guessing.
        </Item>
        <Item term="Quick fill: Met target / Nil period / Shortfall">
          Fills in a ready-made sentence for the three common patterns, with no AI call at all. Use it as a
          starting point, then edit it to say what actually happened. "Nil period" is for when nothing occurred;
          "Shortfall" acknowledges a below-target result and asks for a Quality Action.
        </Item>
        <Item term="Evidence / Note">
          Evidence is anything you paste in from ERPNext or logs. Note is a short line on what actually happened
          and why. Both ground the AI's draft — the Note is also saved to a reusable note bank for this activity
          so it is suggested again next cycle.
        </Item>
      </Section>

      <Section title="Working on a whole record">
        <Item term="AI draft empty in this record">
          Goes through every activity in the open record that is still missing text and drafts each one in turn,
          skipping anything already filled in. Blocked if the record has no procedure loaded yet.
        </Item>
        <Item term="Harmonise voice">
          Once several activities in a record are written, this smooths the wording so they all read as one
          consistent voice. It only adjusts tone and phrasing — it never changes a fact, number, or claim.
        </Item>
        <Item term="Reviewed → final (this record)">
          Promotes every activity in this record that is currently "Under review" to "Final", stamping your name
          and today's date. Refuses to finalise anything still blank or containing leftover placeholder text like
          "[...]" — those stay blocked until fixed.
        </Item>
      </Section>

      <Section title="Review states">
        <Item term="Draft / Under review / Final">
          Every activity moves through these three states. Draft is a work in progress. Under review means it is
          ready for a second pair of eyes. Final is signed off and locked in with a reviewer name and date —
          editing the text afterwards drops it back to Under review automatically.
        </Item>
      </Section>

      <Section title="Records sidebar">
        <Item term="Filters">Narrow the record list by GD4 criterion, department, action status, or review state.</Item>
        <Item term="AI draft all empty (all records)">The same drafting as above, but across every record in the cycle.</Item>
        <Item term="Carry forward prior cycle">
          Pulls the previous cycle's narrative into any activity that is still empty this cycle — a starting
          point to edit, not a final answer.
        </Item>
        <Item term="Mark all reviewed → final">Finalises every "Under review" activity across the whole cycle, with the same blank/placeholder gate.</Item>
      </Section>

      <Section title="Criterion library">
        <Item term="GD4 requirement / Procedure (SOP)">
          The requirement is what EduTrust expects; the procedure is how UCC actually does it, and is
          authoritative. Only the matching criterion's requirement and procedure are sent to the AI per draft. No
          procedure loaded means the Draft button refuses for every activity under that criterion.
        </Item>
        <Item term="Upload Word / PDF · Pull from Drive">
          Pulls the text straight out of an uploaded .docx/.pdf file, or from a Google Drive link, instead of
          pasting it by hand.
        </Item>
      </Section>

      <Section title="Settings">
        <Item term="OpenAI">Your API key and the model used for drafting. "Test & fetch models" checks the key works and lists the models available on your account.</Item>
        <Item term="ERPNext / Supabase / Google Drive">
          Each has a "Test" button that checks the connection right away, so you know before you rely on it.
        </Item>
      </Section>

      <Section title="Agent office">
        <Item term="Orchestrator">
          Plans a run across a record — Grounder, Drafter, Shortfall Auditor, Consistency Reviewer, Sign-off
          Auditor — and runs them one at a time. Every step pauses for you to accept or reject before the next
          one runs.
        </Item>
      </Section>
    </div>
  );
}
