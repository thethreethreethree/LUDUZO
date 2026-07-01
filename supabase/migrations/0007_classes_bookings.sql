-- ============================================================================
-- LUDUZO — Phase 5: Scheduling & bookings (classes, sessions, bookings).
-- Builds on 0001 + 0002 (+ locations from 0001).
--
-- Governed by: CLAUDE.md §1.5.1 layer 1 · §1.7 · §3.1 (booking events) ·
--   A12 (safe-to-re-run) · A5 (RLS ripple).
--
-- FLAGGED (defaults; override later): instructor is a free-text name for now
--   (no trainer-entity link yet); member self-booking is deferred — bookings are
--   staff-created. Both flagged, not blocking.
--
-- STATUS: UNTESTED until run. A12: all objects guarded.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type booking_status as enum ('booked','waitlisted','attended','cancelled','no_show');
  end if;
end$$;

-- ---------- classes (a recurring class definition) ----------
create table if not exists classes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  location_id     uuid references locations(id) on delete set null,
  instructor_name text,
  capacity        integer check (capacity is null or capacity >= 0),
  active          boolean not null default true,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_classes_org on classes(organization_id);
drop trigger if exists trg_classes_updated on classes;
create trigger trg_classes_updated before update on classes
  for each row execute function set_updated_at();

-- ---------- class_sessions (a scheduled occurrence) ----------
create table if not exists class_sessions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  class_id        uuid not null references classes(id) on delete cascade,
  location_id     uuid references locations(id) on delete set null,
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  capacity        integer check (capacity is null or capacity >= 0),
  status          text not null default 'scheduled',
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_sessions_org        on class_sessions(organization_id);
create index if not exists idx_sessions_org_time    on class_sessions(organization_id, starts_at);
create index if not exists idx_sessions_class       on class_sessions(class_id);
drop trigger if exists trg_sessions_updated on class_sessions;
create trigger trg_sessions_updated before update on class_sessions
  for each row execute function set_updated_at();

-- ---------- bookings (member <-> session) ----------
create table if not exists bookings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id      uuid not null references class_sessions(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  status          booking_status not null default 'booked',
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (session_id, member_id)
);
create index if not exists idx_bookings_org      on bookings(organization_id);
create index if not exists idx_bookings_session  on bookings(session_id);
create index if not exists idx_bookings_member   on bookings(member_id);
drop trigger if exists trg_bookings_updated on bookings;
create trigger trg_bookings_updated before update on bookings
  for each row execute function set_updated_at();

-- ---------- Append-only booking events (§3.1) ----------
create or replace function bookings_emit_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
    values (new.organization_id, auth.uid(), 'booking.created', 'booking', new.id,
            jsonb_build_object('session_id', new.session_id, 'member_id', new.member_id, 'status', new.status));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
    values (new.organization_id, auth.uid(), 'booking.status_changed', 'booking', new.id,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end$$;
drop trigger if exists trg_bookings_emit_insert on bookings;
create trigger trg_bookings_emit_insert after insert on bookings
  for each row execute function bookings_emit_events();
drop trigger if exists trg_bookings_emit_update on bookings;
create trigger trg_bookings_emit_update after update on bookings
  for each row execute function bookings_emit_events();

-- ---------- RLS (tenant read; staff write) ----------
-- classes/sessions: management (owner/admin/manager); bookings: staff incl front_desk.
do $$
declare t text;
begin
  foreach t in array array['classes','class_sessions']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('create policy %I on %I for select using (organization_id in (select auth_org_ids()))', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format(
      'create policy %I on %I for all '
      || 'using (auth_has_org_role(organization_id, array[''owner'',''admin'',''manager'']::app_role[])) '
      || 'with check (auth_has_org_role(organization_id, array[''owner'',''admin'',''manager'']::app_role[]))',
      t || '_write', t);
  end loop;
end$$;

alter table bookings enable row level security;
drop policy if exists bookings_select on bookings;
create policy bookings_select on bookings for select
  using (organization_id in (select auth_org_ids()));
drop policy if exists bookings_write on bookings;
create policy bookings_write on bookings for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]));

-- End of 0007_classes_bookings.sql
