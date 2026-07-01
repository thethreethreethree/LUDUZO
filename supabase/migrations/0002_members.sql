-- ============================================================================
-- LUDUZO — Phase 2 (core): Organization onboarding + Members
--
-- Builds on 0001 (organizations, locations, profiles, organization_members,
-- events, auth_org_ids(), auth_has_org_role()).
--
-- Governed by:
--   CLAUDE.md §1.5.1 layer 1 (data shape) · §1.7 (ground-up) · §3.1 (events)
--   ThinkerThinker A12 (safe-to-re-run) · A5 (ripple-trace new RLS surfaces)
--
-- Adds:
--   1. create_organization() — SECURITY DEFINER onboarding: caller becomes owner.
--      (Chosen over a broad INSERT policy on organizations — tighter surface.)
--   2. members — a gym's CUSTOMERS (distinct from profiles=auth users and
--      organization_members=staff/RBAC). Optional profile_id link.
--   3. Append-only lifecycle events on member create / status change (§3.1).
--
-- STATUS: UNTESTED — author has not run this against live Supabase (C2).
-- A12: every object guarded with IF NOT EXISTS / OR REPLACE / DROP IF EXISTS.
-- ============================================================================

-- ---------- Enums ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_status') then
    create type member_status as enum
      ('pending','active','frozen','inactive','cancelled','expired');
  end if;
end$$;

-- ---------- Onboarding: create_organization (SECURITY DEFINER) ----------
-- A logged-in user creates their gym and becomes its owner, atomically.
-- SECURITY DEFINER so it can write organizations (which has no INSERT policy),
-- while still attributing ownership/events to the calling user via auth.uid().
create or replace function create_organization(p_name text, p_slug text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'create_organization: not authenticated';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_slug), '') = '' then
    raise exception 'create_organization: name and slug are required';
  end if;

  insert into organizations (name, slug)
    values (trim(p_name), lower(trim(p_slug)))
    returning id into v_org;

  insert into organization_members (organization_id, user_id, role, status)
    values (v_org, v_uid, 'owner', 'active');

  insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
    values (v_org, v_uid, 'organization.created', 'organization', v_org,
            jsonb_build_object('name', trim(p_name), 'slug', lower(trim(p_slug))));

  return v_org;
end$$;

grant execute on function create_organization(text, text) to authenticated;

-- ---------- members (the gym's customers) ----------
create table if not exists members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id      uuid references profiles(id) on delete set null,  -- optional: member is also an app user
  member_number   text,                          -- optional human-facing id, unique per org
  first_name      text not null,
  last_name       text not null,
  email           text,
  phone           text,
  date_of_birth   date,
  status          member_status not null default 'active',
  member_since    date not null default current_date,
  notes           text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_members_org           on members(organization_id);
create index if not exists idx_members_org_status     on members(organization_id, status);
create index if not exists idx_members_org_lastname   on members(organization_id, lower(last_name));
create index if not exists idx_members_email          on members(lower(email));
create index if not exists idx_members_profile        on members(profile_id);
-- member_number unique within an org (when provided)
create unique index if not exists uq_members_org_number
  on members(organization_id, member_number) where member_number is not null;

drop trigger if exists trg_members_updated on members;
create trigger trg_members_updated before update on members
  for each row execute function set_updated_at();

-- ---------- Append-only lifecycle events (§3.1) ----------
-- Emits 'member.created' on insert and 'member.status_changed' on status change.
-- SECURITY DEFINER so the audit write succeeds regardless of the caller's RLS,
-- while actor_id is still the acting user (auth.uid()).
create or replace function members_emit_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
    values (new.organization_id, auth.uid(), 'member.created', 'member', new.id,
            jsonb_build_object('first_name', new.first_name, 'last_name', new.last_name,
                               'status', new.status));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
    values (new.organization_id, auth.uid(), 'member.status_changed', 'member', new.id,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end$$;
drop trigger if exists trg_members_emit_insert on members;
create trigger trg_members_emit_insert after insert on members
  for each row execute function members_emit_events();
drop trigger if exists trg_members_emit_update on members;
create trigger trg_members_emit_update after update on members
  for each row execute function members_emit_events();

-- ---------- RLS ----------
alter table members enable row level security;

-- read: any active member of the tenant (staff or member-role app users).
drop policy if exists members_select on members;
create policy members_select on members for select
  using (organization_id in (select auth_org_ids()));

-- write: staff who manage members (owner / admin / manager / front_desk).
drop policy if exists members_write on members;
create policy members_write on members for all
  using (auth_has_org_role(organization_id,
           array['owner','admin','manager','front_desk']::app_role[]))
  with check (auth_has_org_role(organization_id,
           array['owner','admin','manager','front_desk']::app_role[]));

-- End of 0002_members.sql
