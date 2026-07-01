-- ============================================================================
-- LUDUZO — Phase 5+ : Announcements (gym-wide communication). Builds on 0001.
-- Governed by: CLAUDE.md §1.5.1 layer 1 · §1.7 · A12 (safe-to-re-run) · A5 (RLS).
-- STATUS: UNTESTED until run. A12: all objects guarded.
-- ============================================================================

create table if not exists announcements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title           text not null,
  body            text,
  published       boolean not null default true,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_announcements_org on announcements(organization_id, created_at desc);
drop trigger if exists trg_announcements_updated on announcements;
create trigger trg_announcements_updated before update on announcements
  for each row execute function set_updated_at();

alter table announcements enable row level security;
drop policy if exists announcements_select on announcements;
create policy announcements_select on announcements for select
  using (organization_id in (select auth_org_ids()));
drop policy if exists announcements_write on announcements;
create policy announcements_write on announcements for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

-- End of 0009_announcements.sql
