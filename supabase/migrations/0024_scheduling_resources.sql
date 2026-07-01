-- ============================================================================
-- LUDUZO — Phase 1: Scheduling & Resources. Builds on 0001, 0002, 0007.
--
-- Governed by: CLAUDE.md §1.5.1 layer 1 (data shape) · §3.1 (append-only events)
--   · A5 (RLS ripple traced) · A12 (idempotent / safe-to-re-run).
--
-- Adds:
--   1. appointments        — 1:1 / PT appointments (member + trainer + slot).
--   2. resources           — bookable assets: courts, rooms, lockers, equipment.
--   3. resource_bookings    — a member's booking of a resource for a time slot.
--   4. trainer_availability — a trainer's weekly availability windows.
--   5. classes cancellation policy columns + waitlist auto-promote on bookings.
--
-- RLS pattern (A5): tenant SELECT via auth_org_ids(); staff WRITE via
--   auth_has_org_role(org, owner/admin/manager/front_desk); members read their own.
--
-- STATUS: applied + verified live by the agent on run. A12: every object guarded.
-- ============================================================================

-- ---------- enums ----------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'appointment_status') then
    create type appointment_status as enum ('scheduled','completed','cancelled','no_show');
  end if;
  if not exists (select 1 from pg_type where typname = 'resource_type') then
    create type resource_type as enum ('court','room','locker','equipment','other');
  end if;
end $$;

-- ---------- appointments (PT / 1:1) ----------
create table if not exists appointments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id       uuid references members(id) on delete set null,
  trainer_id      uuid references profiles(id) on delete set null,
  title           text,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  status          appointment_status not null default 'scheduled',
  price_cents     integer not null default 0 check (price_cents >= 0),
  notes           text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists idx_appointments_org        on appointments(organization_id);
create index if not exists idx_appointments_org_time   on appointments(organization_id, starts_at desc);
create index if not exists idx_appointments_member      on appointments(member_id);
create index if not exists idx_appointments_trainer     on appointments(trainer_id);
drop trigger if exists trg_appointments_updated on appointments;
create trigger trg_appointments_updated before update on appointments
  for each row execute function set_updated_at();

-- ---------- resources (bookable) ----------
create table if not exists resources (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id     uuid references locations(id) on delete set null,
  name            text not null,
  type            resource_type not null default 'other',
  capacity        integer not null default 1 check (capacity >= 1),
  hourly_rate_cents integer not null default 0 check (hourly_rate_cents >= 0),
  active          boolean not null default true,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_resources_org on resources(organization_id);
drop trigger if exists trg_resources_updated on resources;
create trigger trg_resources_updated before update on resources
  for each row execute function set_updated_at();

-- ---------- resource_bookings ----------
create table if not exists resource_bookings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  resource_id     uuid not null references resources(id) on delete cascade,
  member_id       uuid references members(id) on delete set null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  status          text not null default 'booked',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists idx_resource_bookings_org      on resource_bookings(organization_id);
create index if not exists idx_resource_bookings_resource on resource_bookings(resource_id, starts_at);
drop trigger if exists trg_resource_bookings_updated on resource_bookings;
create trigger trg_resource_bookings_updated before update on resource_bookings
  for each row execute function set_updated_at();

-- Prevent double-booking the same resource for overlapping active windows.
create or replace function resource_bookings_no_overlap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' then return new; end if;
  if exists (
    select 1 from resource_bookings b
    where b.resource_id = new.resource_id
      and b.id <> new.id
      and b.status <> 'cancelled'
      and tstzrange(b.starts_at, b.ends_at) && tstzrange(new.starts_at, new.ends_at)
  ) then
    raise exception 'resource is already booked for that time' using errcode = 'exclusion_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_resource_bookings_no_overlap on resource_bookings;
create trigger trg_resource_bookings_no_overlap before insert or update on resource_bookings
  for each row execute function resource_bookings_no_overlap();

-- ---------- trainer_availability ----------
create table if not exists trainer_availability (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  trainer_id      uuid not null references profiles(id) on delete cascade,
  weekday         integer not null check (weekday between 0 and 6), -- 0=Sunday
  start_time      time not null,
  end_time        time not null,
  created_at      timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists idx_trainer_availability_org on trainer_availability(organization_id, trainer_id);

-- ---------- classes: cancellation policy + recurrence hint ----------
alter table classes add column if not exists cancellation_hours integer not null default 0;
alter table class_sessions add column if not exists recurrence text; -- e.g. 'weekly' (informational)

-- ---------- append-only events (§3.1) ----------
create or replace function appointments_emit_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
    values (new.organization_id, auth.uid(), 'appointment.scheduled', 'appointment', new.id,
            jsonb_build_object('member_id', new.member_id, 'trainer_id', new.trainer_id, 'starts_at', new.starts_at));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
    values (new.organization_id, auth.uid(), 'appointment.status_changed', 'appointment', new.id,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;
drop trigger if exists trg_appointments_emit_insert on appointments;
create trigger trg_appointments_emit_insert after insert on appointments
  for each row execute function appointments_emit_events();
drop trigger if exists trg_appointments_emit_update on appointments;
create trigger trg_appointments_emit_update after update on appointments
  for each row execute function appointments_emit_events();

-- ---------- waitlist auto-promote (completes the 0007 'waitlisted' status) ----------
-- When a 'booked' seat frees up (cancelled/no_show), promote the oldest waitlisted
-- booking for that session to 'booked' if capacity now allows.
create or replace function bookings_promote_waitlist()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cap integer;
  v_count integer;
  v_next uuid;
begin
  if not (tg_op = 'UPDATE' and old.status = 'booked' and new.status in ('cancelled','no_show')) then
    return new;
  end if;
  select coalesce(cs.capacity, c.capacity) into v_cap
    from class_sessions cs join classes c on c.id = cs.class_id
    where cs.id = new.session_id;
  if v_cap is null then return new; end if; -- unlimited: nothing to promote
  select count(*) into v_count from bookings
    where session_id = new.session_id and status in ('booked','attended');
  if v_count >= v_cap then return new; end if;
  select id into v_next from bookings
    where session_id = new.session_id and status = 'waitlisted'
    order by created_at asc limit 1;
  if v_next is not null then
    update bookings set status = 'booked' where id = v_next;
  end if;
  return new;
end $$;
drop trigger if exists trg_bookings_promote_waitlist on bookings;
create trigger trg_bookings_promote_waitlist after update on bookings
  for each row execute function bookings_promote_waitlist();

-- ---------- RLS (A5) ----------
alter table appointments enable row level security;
alter table resources enable row level security;
alter table resource_bookings enable row level security;
alter table trainer_availability enable row level security;

drop policy if exists appointments_select on appointments;
create policy appointments_select on appointments for select
  using (organization_id in (select auth_org_ids())
         or member_id in (select auth_member_ids()));
drop policy if exists appointments_write on appointments;
create policy appointments_write on appointments for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]));

drop policy if exists resources_select on resources;
create policy resources_select on resources for select
  using (organization_id in (select auth_org_ids()));
drop policy if exists resources_write on resources;
create policy resources_write on resources for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

drop policy if exists resource_bookings_select on resource_bookings;
create policy resource_bookings_select on resource_bookings for select
  using (organization_id in (select auth_org_ids())
         or member_id in (select auth_member_ids()));
drop policy if exists resource_bookings_write on resource_bookings;
create policy resource_bookings_write on resource_bookings for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]));

drop policy if exists trainer_availability_select on trainer_availability;
create policy trainer_availability_select on trainer_availability for select
  using (organization_id in (select auth_org_ids()));
drop policy if exists trainer_availability_write on trainer_availability;
create policy trainer_availability_write on trainer_availability for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

-- End of 0024_scheduling_resources.sql
