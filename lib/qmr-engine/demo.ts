import type { Db, Item } from "./types";
import { activeCycle, activityKey } from "./db";
import { clone } from "./util";
import { createCycle } from "./cycles";

/* =========================================================
   DEMO DATA (ported verbatim from qmr-workbench.html)

   Three records exercise the whole engine:
     UCC-QMR-250017  blank activities to draft (incl. a nil case)
     UCC-QMR-250006  below-target shortfalls (checks fire)
     UCC-QMR-250012  already drafted, with critique + a Final row
   ========================================================= */

export const DEMO_EXEMPLARS = {
  met: [
    "All enrolled students completed pre-course counselling prior to enrolment confirmation in accordance with admission requirements, with counselling completion evidence captured in the Pre-Course Counselling Records.",
    "Teachers assigned to modules were approved by the Academic Board prior to deployment, and SSG registration was verified before course commencement, confirming teaching suitability and compliance.",
    "The planning calendar was prepared by Course Management, vetted by ALI, and approved by the Principal at least 30 days before the academic period, in line with the planning timeline.",
  ].join("\n\n"),
  nil: [
    "No borderline or special admission cases required approval during the monitoring period. Controls for managing such cases remain in place and ready for use when required.",
    "No refund requests were submitted during the monitoring period. Refund request documentation controls remain in place and ready for activation should requests arise.",
    "No transfer requests were submitted during the monitoring period. Controls for processing transfer requests within the defined timeframe remain in place.",
  ].join("\n\n"),
  short: [
    "Stakeholder engagement activities were partially completed, achieving 50% against a target of 100%. The shortfall arose because informal engagements were not consistently recorded in the central stakeholder engagement log during the first half of the period.",
    "Grievance resolution reached 97% against a target of 100%. The shortfall was due to two cases that extended beyond the service level timeframe pending third-party responses, both since resolved.",
    "Communication approval compliance reached 50% against a target of 100%. The shortfall reflected informal dissemination that referenced content not yet vetted, which the material approval process is being tightened to prevent.",
  ].join("\n\n"),
};

export const DEMO_REQ: Record<string, string> = {
  "GD4_4.5.1":
    "GD4 Criterion 4.5.1 (EduTrust) — Student Support Services: The PEI must have processes to support students throughout their candidature, including orientation for new students, provision of student support services covering academic and non-academic needs, and pastoral care with appropriate follow-up. The PEI must demonstrate that these services are planned, delivered, and reviewed, with records maintained as evidence.",
  "GD4_2.2.1":
    "GD4 Criterion 2.2.1 (EduTrust) — Corporate and Marketing Communications: The PEI must ensure that engagement with stakeholders is planned and conducted, that essential information provided to stakeholders is accurate and current, and that all marketing and communication materials are vetted and approved before release. The PEI must retain records demonstrating control over the accuracy and approval of information disseminated.",
  "GD4_4.1.1":
    "GD4 Criterion 4.1.1 (EduTrust) — Pre-Course, Admission and Enrolment: The PEI must provide pre-course counselling to prospective students, apply documented admission requirements consistently, manage borderline and special cases through a defined process, and communicate admission outcomes clearly. Records of counselling, selection, and admission decisions must be maintained as evidence.",
};

export const DEMO_PROC: Record<string, string> = {
  "GD4_4.5.1":
    "STUDENT SUPPORT SERVICES PROCEDURE (GD4_4.5.1)\n1. Orientation: SS conducts an orientation programme for every new intake. Attendance is recorded in the Orientation Attendance Records and feedback captured via the Orientation Feedback Survey. Required components: institution overview, academic policies, student support channels, emergency and wellbeing contacts.\n2. Student support services: SS maintains documented support services (academic, financial, wellbeing, career). Needs are tracked through the Student Support Service Strategy Insights and reviewed at least annually.\n3. Continuous pastoral care: pastoral cases are logged in Pastoral Care Case Records with follow-up notes, managed through a closed loop, and formally closed per the support protocol. Where no cases arise in a period, the process remains ready for activation.\nEvidence: attendance records, feedback survey, strategy insights, pastoral case records.",
  "GD4_2.2.1":
    "MARKETING AND COMMUNICATION PROCEDURE (GD4_2.2.1)\n1. Stakeholder engagement: HOD executes the approved stakeholder engagement plan and records every engagement (formal and informal) in a central stakeholder engagement log. Target is full coverage of planned engagement activities.\n2. Essential information: the Information Owner reviews, updates and obtains approval for essential information on the scheduled cycle, recorded in Essential Information Review Records.\n3. Communication updates: all communication materials are vetted and approved before dissemination per the material approval process, with approved versions retained as the authoritative source. Informal dissemination must reference approved content.\nEvidence: stakeholder engagement log, essential information review records, material vetting and approval records.",
  "GD4_4.1.1":
    "ADMISSION PROCEDURE (GD4_4.1.1)\n1. Pre-course counselling: SES conducts pre-course counselling for every prospective student before enrolment confirmation, recorded in the Counselling Feedback records. Counselling covers course suitability, requirements, fees, and policies.\n2. Admission requirements: applications are assessed against documented admission criteria before approval by the Academic Board.\n3. Borderline or special cases: cases not meeting standard criteria are managed through the borderline and special case approval process and fully documented before enrolment. Where none arise, the process remains ready.\n4. Admission communication: admission outcomes are communicated through approved channels and logged.\nEvidence: counselling feedback, application assessment records, special case approval records, admission communication log.",
};

type DemoItem = Partial<Item> & { name: string; activity_name: string };
interface DemoRecord {
  department: string;
  criterion: string;
  items: DemoItem[];
}

export const DEMO_RECORDS: Record<string, DemoRecord> = {
  "UCC-QMR-250017": {
    department: "Student Support (SS)",
    criterion: "GD4_4.5.1",
    items: [
      {
        name: "d-ss-1",
        activity_name: "Orientation Programme Procedure",
        feedback_source: "Orientation Attendance Records, Orientation Feedback Survey",
        frequency: "Annually",
        timing: "Department Meeting",
        ownership: "SS",
        kpi_metric: "Orientation participation and engagement rate",
        kpi_target_value: 100,
        kpi_actual_value: null,
        uom: "%",
        kpi_target_desc:
          "Measures the proportion of new students who attend orientation and participate in required components.",
        _note: "All new students attended orientation for both intakes; feedback survey returned.",
        evidence_text: "Orientation Attendance Records Jan and Jul intakes; Orientation Feedback Survey summary.",
      },
      {
        name: "d-ss-2",
        activity_name: "Student Support Services",
        feedback_source: "Student Support Service Strategy Insights",
        frequency: "Annually",
        timing: "Department Meeting",
        ownership: "SS",
        kpi_metric: "Support Needs Review",
        kpi_target_value: 100,
        kpi_actual_value: null,
        uom: "%",
        kpi_target_desc: "Tracks whether documented student support services are implemented and reviewed.",
      },
      {
        name: "d-ss-3",
        activity_name: "Continuous Pastoral Care",
        feedback_source: "Pastoral Care Case Records, Follow-up Notes",
        frequency: "Annually",
        timing: "Department Meeting",
        ownership: "SS",
        kpi_metric: "Pastoral care case closure rate",
        kpi_target_value: 100,
        kpi_actual_value: null,
        uom: "%",
        kpi_target_desc:
          "Measures the proportion of pastoral care cases managed, followed up, and formally closed.",
        _note: "No pastoral cases arose this period.",
      },
    ],
  },
  "UCC-QMR-250006": {
    department: "Marketing (MG)",
    criterion: "GD4_2.2.1",
    items: [
      {
        name: "d-mg-1",
        activity_name: "Stakeholder engagement strategy creation and implementation",
        feedback_source: "Stakeholder Engagement Records",
        frequency: "Annually",
        timing: "Department Meeting",
        ownership: "HOD",
        kpi_metric: "Stakeholder engagement activity completion rate",
        kpi_target_value: 100,
        kpi_actual_value: 50,
        uom: "%",
        kpi_target_desc: "Tracks whether planned stakeholder engagement activities are conducted and documented.",
        evaluation_text:
          "Stakeholder engagement activities were carried out in line with the engagement strategy, with engagement interactions recorded in a central stakeholder engagement log.",
        improvement_action:
          "Maintain centralised recording of stakeholder engagement activities to improve traceability.",
        action_status: "Completed",
      },
      {
        name: "d-mg-3",
        activity_name: "Disseminate and approve communication updates",
        feedback_source: "Material Vetting and Approval Records",
        frequency: "Annually",
        timing: "Department Meeting",
        ownership: "Information Owner",
        kpi_metric: "Communication approval compliance rate",
        kpi_target_value: 100,
        kpi_actual_value: 50,
        uom: "%",
        kpi_target_desc: "Tracks whether communication materials are vetted and approved before dissemination.",
        evaluation_text:
          "Communication materials were approved prior to dissemination, with approved versions retained as the authoritative source.",
        improvement_action: "Maintain central storage of approved communication materials.",
        action_status: "Completed",
      },
    ],
  },
  "UCC-QMR-250012": {
    department: "Admissions (AD)",
    criterion: "GD4_4.1.1",
    items: [
      {
        name: "d-ad-1",
        activity_name: "Pre-Course Counselling Procedure",
        feedback_source: "Counselling Feedback from Students",
        frequency: "Annually",
        timing: "Department Meeting",
        ownership: "SES",
        kpi_metric: "Pre-course counselling completion rate",
        kpi_target_value: 100,
        kpi_actual_value: 100,
        uom: "%",
        kpi_target_desc:
          "Measures whether all enrolled students completed pre-course counselling before enrolment confirmation.",
        evaluation_text:
          "All enrolled students completed pre-course counselling prior to enrolment confirmation in accordance with the admission requirement, with completion evidence captured in the Counselling Feedback records.",
        improvement_action:
          "Maintain the requirement for pre-course counselling before enrolment confirmation and continue capturing counselling completion evidence.",
        action_status: "Completed",
        review_state: "Under Review",
        _note: "All enrolled students counselled before enrolment.",
        evidence_text: "Counselling Feedback from Students, full intake.",
        _critique: {
          assumptions: "Assumed the 100% actual reflects every enrolled student, per the counselling feedback records.",
          weakest: "An auditor may ask to see the counselling record for each named student rather than an aggregate rate.",
          fixed: "",
          model: "gpt-4o",
        },
      },
      {
        name: "d-ad-4",
        activity_name: "Borderline or Special Cases Procedure",
        feedback_source: "Feedback from Applicants",
        frequency: "Annually",
        timing: "Department Meeting",
        ownership: "SES",
        kpi_metric: "Special Cases Approved",
        kpi_target_value: 100,
        kpi_actual_value: 0,
        uom: "%",
        kpi_target_desc: "Tracks whether all approved special or borderline cases are fully documented before enrolment.",
        evaluation_text:
          "No borderline or special admission cases required approval during the monitoring period. Controls for managing such cases remain in place and ready for use when required.",
        improvement_action:
          "Maintain readiness of the special or borderline case approval process and apply it whenever such cases arise.",
        action_status: "Completed",
        review_state: "Final",
        reviewed_by: "Felix Oking",
        reviewed_on: "2025-12-20",
        _note: "No special cases this period.",
        _critique: {
          assumptions: "Assumed a nil-activity period based on the note and the zero actual.",
          weakest: "",
          fixed: "",
          model: "gpt-4o",
        },
      },
    ],
  },
};

function buildDemoItem(db: Db, criterion: string, it: DemoItem): Item {
  const rec = { criterion };
  return {
    name: it.name,
    activity_name: it.activity_name || "",
    feedback_source: it.feedback_source || "",
    frequency: it.frequency || "",
    timing: it.timing || "",
    ownership: it.ownership || "",
    kpi_metric: it.kpi_metric || "",
    kpi_target_value: it.kpi_target_value === undefined ? null : it.kpi_target_value,
    kpi_actual_value: it.kpi_actual_value === undefined ? null : it.kpi_actual_value,
    uom: it.uom || "",
    kpi_target_desc: it.kpi_target_desc || "",
    evaluation_text: it.evaluation_text || "",
    improvement_action: it.improvement_action || "",
    action_status: it.action_status || "Planned",
    review_state: it.review_state || "Draft",
    reviewed_by: it.reviewed_by || "",
    reviewed_on: it.reviewed_on || "",
    evidence_text: it.evidence_text || "",
    _note: it._note || db.noteBank[activityKey(rec, it)] || "",
    _refusal: null,
    _critique: it._critique || null,
    _carry: null,
  };
}

/** Seed the demo records into the active cycle (creating a demo cycle if none). */
export function loadDemoRecords(db: Db): Db {
  let d = clone(db);
  if (!activeCycle(d)) {
    d = createCycle(d, "2025 (demo)", "2025-01-01", "2025-12-31", null).db;
  }
  const c = activeCycle(d)!;
  Object.entries(DEMO_RECORDS).forEach(([pn, dd]) => {
    c.records[pn] = {
      name: pn,
      department: dd.department,
      criterion: dd.criterion,
      period_from: c.period_from,
      period_to: c.period_to,
      items: dd.items.map((it) => buildDemoItem(d, dd.criterion, it)),
    };
  });
  return d;
}

/**
 * Full demo load: exemplars + GD4 requirements + procedures + AI defaults +
 * the three records. Only fills fields the user has not already set.
 */
export function loadDemo(db: Db): Db {
  let d = clone(db);
  Object.entries(DEMO_REQ).forEach(([cr, txt]) => {
    if (!d.requirements[cr]) d.requirements[cr] = txt;
  });
  Object.entries(DEMO_PROC).forEach(([cr, txt]) => {
    if (!d.procedures[cr]) d.procedures[cr] = txt;
  });
  if (!d.exemplars || (!d.exemplars.met && !d.exemplars.nil && !d.exemplars.short)) {
    d.exemplars = { met: DEMO_EXEMPLARS.met, nil: DEMO_EXEMPLARS.nil, short: DEMO_EXEMPLARS.short };
  }
  d.settings = d.settings || {};
  if (!d.settings.openaiModel) d.settings.openaiModel = "gpt-4o-mini";
  if (!d.settings.finalModel) d.settings.finalModel = "gpt-4o";
  if (d.settings.selfCheck === undefined) d.settings.selfCheck = true;
  return loadDemoRecords(d);
}
