/* Supabase migration SQL, ported from qmr-workbench.html (MIGRATION_SQL).
   The canonical copy also lives at supabase/migrations/0001_init.sql; this
   string powers the in-app "Download migration SQL" export. The qmr_agents
   table for the agent layer is added in a later phase. */

export const MIGRATION_SQL = `-- UCC QMR Workbench - Supabase schema
-- Run once in the Supabase SQL editor (Codespace workflow).
create table if not exists qmr_procedures (
  criterion text primary key,
  procedure_text text,
  requirement_text text,
  drive_link text,
  updated_at timestamptz default now()
);
create table if not exists qmr_cycles (
  id text primary key,
  name text not null,
  period_from date,
  period_to date,
  seeded_from text,
  created_at timestamptz default now()
);
create table if not exists qmr_records (
  cycle_id text references qmr_cycles(id) on delete cascade,
  name text not null,
  department text,
  criterion text,
  period_from date,
  period_to date,
  primary key (cycle_id, name)
);
create table if not exists qmr_items (
  cycle_id text,
  record_name text,
  name text,
  activity_name text,
  feedback_source text,
  frequency text,
  timing text,
  ownership text,
  kpi_metric text,
  kpi_target_value numeric,
  kpi_actual_value numeric,
  uom text,
  kpi_target_desc text,
  evaluation_text text,
  improvement_action text,
  action_status text,
  review_state text default 'Draft',
  reviewed_by text,
  reviewed_on date,
  evidence_text text,
  note text,
  primary key (cycle_id, record_name, name),
  foreign key (cycle_id, record_name) references qmr_records(cycle_id, name) on delete cascade
);
create table if not exists qmr_note_bank (
  activity_key text primary key,
  note text
);
create table if not exists qmr_agents (
  id text primary key,
  name text not null,
  role text,
  system_prompt text,
  color text,
  desk_position jsonb,
  enabled boolean default true,
  scope text default 'record',
  updated_at timestamptz default now()
);
-- Adjust RLS to your needs. For a single-user tool matching the
-- Marketing OS open-policy pattern, you may enable RLS with a permissive policy.
alter table qmr_procedures enable row level security;
alter table qmr_cycles enable row level security;
alter table qmr_records enable row level security;
alter table qmr_items enable row level security;
alter table qmr_note_bank enable row level security;
alter table qmr_agents enable row level security;
`;
