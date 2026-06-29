-- ============================================================================
-- LUDUZO — Phase 1 Foundation
-- Multi-tenancy · identity · RBAC · RLS tenant isolation · append-only events
--
-- Governed by:
--   CLAUDE.md §0  (understanding precedes solving)
--   CLAUDE.md §1.5.1 layer 1 (build structure / data shape sound)
--   CLAUDE.md §1.7 (ground-up: this is the foundational layer)
--   CLAUDE.md §3.1 (events are immutable, append-only — hybrid model, C4)
--   ThinkerThinker A12 (migration safe-to-re-run by construction)
--   ThinkerThinker A5  (tenancy = a gating decision, ripple-traced up front)
--
-- STATUS: UNTESTED — has NOT been run against a live Supabase instance (founder choice C2).
-- A12: every object is created with IF NOT EXISTS / guarded DO-blocks / DROP-IF-EXISTS,
--      so this file is safe to re-run against a partially-applied database.
-- ============================================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ---------- Enums ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum
      ('super_admin','owner','admin','manager','trainer','front_desk','member');
  end if;
  if not exists (select 1 from pg_type where typname = 'entity_status') then
    create type entity_status as enum ('active','inactive','suspended','pending');
  end if;
end$$;

-- ---------- Shared trigger fn: updated_at ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

-- ---------- organizations (the tenant) ----------
create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  status      entity_status not null default 'active',
  settings    jsonb not null default '{}'::jsonb,   -- white-label branding, etc.
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_org_updated on organizations;
create trigger trg_org_updated before update on organizations
  for each row execute function set_updated_at();

-- ---------- locations (branches within a tenant) ----------
create table if not exists locations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  address         jsonb not null default '{}'::jsonb,
  timezone        text not null default 'UTC',
  capacity        integer,                            -- occupancy limit
  status          entity_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_locations_org on locations(organization_id);
drop trigger if exists trg_loc_updated on locations;
create trigger trg_loc_updated before update on locations
  for each row execute function set_updated_at();

-- ---------- profiles (extends auth.users) ----------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_profile_updated on profiles;
create trigger trg_profile_updated before update on profiles
  for each row execute function set_updated_at();

-- Auto-create a profile row when an auth user is created (standard Supabase pattern).
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- organization_members (RBAC join: user <-> org <-> role) ----------
create table if not exists organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  role            app_role not null default 'member',
  location_id     uuid references locations(id) on delete set null,  -- location-scoped staff
  status          entity_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index if not exists idx_orgmem_org  on organization_members(organization_id);
create index if not exists idx_orgmem_user on organization_members(user_id);
drop trigger if exists trg_orgmem_updated on organization_members;
create trigger trg_orgmem_updated before update on organization_members
  for each row execute function set_updated_at();

-- ---------- events (HYBRID append-only immutable stream — CLAUDE.md §3.1) ----------
create table if not exists events (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_id        uuid references profiles(id) on delete set null,
  event_type      text not null,         -- e.g. 'member.created','checkin.recorded','payment.succeeded'
  subject_type    text,                  -- e.g. 'member','payment','booking'
  subject_id      uuid,
  payload         jsonb not null default '{}'::jsonb,
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index if not exists idx_events_org_time on events(organization_id, occurred_at desc);
create index if not exists idx_events_subject  on events(subject_type, subject_id);

-- §3.1: append-only — never update or delete. Enforce at DB level (fires even for service_role).
create or replace function events_block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'events is append-only (CLAUDE.md §3.1): % is not permitted', tg_op;
end$$;
drop trigger if exists trg_events_no_update on events;
create trigger trg_events_no_update before update on events
  for each row execute function events_block_mutation();
drop trigger if exists trg_events_no_delete on events;
create trigger trg_events_no_delete before delete on events
  for each row execute function events_block_mutation();

-- ---------- RLS helper functions (security definer to avoid policy recursion) ----------
create or replace function auth_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select organization_id from organization_members
  where user_id = auth.uid() and status = 'active';
$$;

create or replace function auth_has_org_role(org uuid, roles app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members
    where user_id = auth.uid() and organization_id = org
      and status = 'active' and role = any(roles)
  );
$$;

create or replace function auth_shares_org_with(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from organization_members m1
    join organization_members m2 on m1.organization_id = m2.organization_id
    where m1.user_id = auth.uid() and m2.user_id = target and m1.status = 'active'
  );
$$;

-- ---------- Enable RLS ----------
alter table organizations        enable row level security;
alter table locations            enable row level security;
alter table profiles             enable row level security;
alter table organization_members enable row level security;
alter table events               enable row level security;

-- organizations: members read their orgs; owner/admin update.
drop policy if exists org_select on organizations;
create policy org_select on organizations for select
  using (id in (select auth_org_ids()));
drop policy if exists org_update on organizations;
create policy org_update on organizations for update
  using (auth_has_org_role(id, array['owner','admin']::app_role[]))
  with check (auth_has_org_role(id, array['owner','admin']::app_role[]));

-- locations: tenant-scoped read; manager+ write.
drop policy if exists loc_select on locations;
create policy loc_select on locations for select
  using (organization_id in (select auth_org_ids()));
drop policy if exists loc_write on locations;
create policy loc_write on locations for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

-- profiles: self read/write; co-members of a shared org may read.
drop policy if exists profile_self on profiles;
create policy profile_self on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profile_comember_read on profiles;
create policy profile_comember_read on profiles for select
  using (auth_shares_org_with(id));

-- organization_members: tenant-scoped read; owner/admin manage.
drop policy if exists orgmem_select on organization_members;
create policy orgmem_select on organization_members for select
  using (organization_id in (select auth_org_ids()));
drop policy if exists orgmem_write on organization_members;
create policy orgmem_write on organization_members for all
  using (auth_has_org_role(organization_id, array['owner','admin']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin']::app_role[]));

-- events: tenant-scoped read; insert by active members; no update/delete (RLS + trigger). §3.1
drop policy if exists events_select on events;
create policy events_select on events for select
  using (organization_id in (select auth_org_ids()));
drop policy if exists events_insert on events;
create policy events_insert on events for insert
  with check (organization_id in (select auth_org_ids()));

-- End of 0001_foundation.sql
