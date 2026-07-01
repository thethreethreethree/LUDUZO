-- ============================================================================
-- LUDUZO — Phase 5+ (engagement/retention): member progress measurements.
-- Builds on 0002 (members). Governed by: §1.5.1 L1 · §1.7 · A5 · A12. UNTESTED until run.
-- ============================================================================

create table if not exists member_measurements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  recorded_at     date not null default current_date,
  weight_kg       numeric(6,2),
  body_fat_pct    numeric(5,2),
  notes           text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_measurements_member on member_measurements(member_id, recorded_at desc);
create index if not exists idx_measurements_org on member_measurements(organization_id);
drop trigger if exists trg_measurements_updated on member_measurements;
create trigger trg_measurements_updated before update on member_measurements
  for each row execute function set_updated_at();

alter table member_measurements enable row level security;
drop policy if exists measurements_select on member_measurements;
create policy measurements_select on member_measurements for select
  using (organization_id in (select auth_org_ids()));
drop policy if exists measurements_write on member_measurements;
create policy measurements_write on member_measurements for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager','trainer']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager','trainer']::app_role[]));

-- End of 0014_measurements.sql
