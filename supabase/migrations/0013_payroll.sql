-- ============================================================================
-- LUDUZO — Phase 5+: Trainer/staff ops — commissions & time tracking (payroll).
-- Builds on 0001 (+ members from 0002 for commission attribution).
--
-- Sensitivity: payroll data is NOT tenant-wide readable. Read = management
-- (owner/admin/manager) OR the staff member's own rows. Write = management.
--
-- Governed by: CLAUDE.md §1.5.1 layer 1 · §1.7 · A5 (RLS ripple) · A12. UNTESTED until run.
-- ============================================================================

create table if not exists commissions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  staff_user_id   uuid not null references profiles(id) on delete cascade,
  member_id       uuid references members(id) on delete set null,
  amount_cents    integer not null default 0 check (amount_cents >= 0),
  currency        text not null default 'usd',
  reason          text,
  status          text not null default 'pending',   -- pending/approved/paid
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_commissions_org   on commissions(organization_id);
create index if not exists idx_commissions_staff on commissions(staff_user_id);
drop trigger if exists trg_commissions_updated on commissions;
create trigger trg_commissions_updated before update on commissions
  for each row execute function set_updated_at();

create table if not exists time_entries (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  staff_user_id   uuid not null references profiles(id) on delete cascade,
  clock_in        timestamptz not null default now(),
  clock_out       timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_time_entries_org   on time_entries(organization_id);
create index if not exists idx_time_entries_staff on time_entries(staff_user_id);
drop trigger if exists trg_time_entries_updated on time_entries;
create trigger trg_time_entries_updated before update on time_entries
  for each row execute function set_updated_at();

-- ---------- RLS ----------
-- commissions: read = management OR own; write = management only (staff must not
--   create their own commissions).
alter table commissions enable row level security;
drop policy if exists commissions_select on commissions;
create policy commissions_select on commissions for select using (
  auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[])
  or staff_user_id = auth.uid()
);
drop policy if exists commissions_write on commissions;
create policy commissions_write on commissions for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

-- time_entries: read = management OR own; write = management OR own (staff clock
--   their own time). The own-write is scoped to the caller's OWN rows and requires
--   the caller to be an active member of that org (auth_org_ids).
alter table time_entries enable row level security;
drop policy if exists time_entries_select on time_entries;
create policy time_entries_select on time_entries for select using (
  auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[])
  or staff_user_id = auth.uid()
);
drop policy if exists time_entries_write on time_entries;
create policy time_entries_write on time_entries for all
  using (
    auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[])
    or (staff_user_id = auth.uid() and organization_id in (select auth_org_ids()))
  )
  with check (
    auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[])
    or (staff_user_id = auth.uid() and organization_id in (select auth_org_ids()))
  );

-- End of 0013_payroll.sql
