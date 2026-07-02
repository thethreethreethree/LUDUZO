-- ============================================================================
-- LUDUZO — Member self-logged workouts (§5).
--
-- Governed by: §3.1 (append-only-ish log) · §3.2 (RLS structural) · §1.5.1 L1
--   (data shape) · A5 · A12. [Assets re-read in-session 2026-07-02.]
--
-- Model (flagged v1 choice): FLAT — one row per exercise entry, mirroring
-- member_measurements. A "workout" is the set of entries a member logs on a date;
-- no separate parent table for v1 (least surface, composes with the existing
-- self-log pattern). Structured workout→exercises can be layered later if needed.
--
-- RLS: a member inserts + reads their OWN entries; staff read their org's.
-- ============================================================================

create table if not exists member_workout_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  performed_on    date not null default current_date,
  exercise        text not null,
  sets            integer check (sets is null or (sets >= 0 and sets <= 99)),
  reps            integer check (reps is null or (reps >= 0 and reps <= 999)),
  weight_kg       numeric(6,2) check (weight_kg is null or (weight_kg >= 0 and weight_kg <= 999)),
  created_at      timestamptz not null default now()
);
create index if not exists idx_workout_logs_member on member_workout_logs(member_id, performed_on desc);

alter table member_workout_logs enable row level security;

drop policy if exists workout_logs_member_insert on member_workout_logs;
create policy workout_logs_member_insert on member_workout_logs for insert
  with check (member_id in (select auth_member_ids())
              and organization_id in (select auth_member_org_ids()));

drop policy if exists workout_logs_member_read on member_workout_logs;
create policy workout_logs_member_read on member_workout_logs for select
  using (member_id in (select auth_member_ids()));

drop policy if exists workout_logs_staff_read on member_workout_logs;
create policy workout_logs_staff_read on member_workout_logs for select
  using (organization_id in (select auth_org_ids()));

-- End of 0047_member_workout_logs.sql
