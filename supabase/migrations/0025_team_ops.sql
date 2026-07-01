-- ============================================================================
-- LUDUZO — Phase 2: Team Operations. Builds on 0001, 0002.
--
-- Governed by: CLAUDE.md §1.5.1 layer 1 · §3.1 (events) · A5 (RLS) · A12.
--
-- Adds:
--   1. staff_shifts        — shift scheduling for staff.
--   2. tasks               — task assignment with status + priority.
--   3. internal_messages   — simple staff-to-staff direct messages.
--   4. staff_certifications — certification / license expiry tracking.
--   (Trainer performance metrics are DERIVED at query time from appointments /
--    bookings / commissions — no new table; see /dashboard/team.)
--
-- STATUS: applied + verified live by the agent on run. A12: all objects guarded.
-- ============================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type task_status as enum ('open','in_progress','done','cancelled');
  end if;
end $$;

-- ---------- staff_shifts ----------
create table if not exists staff_shifts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  staff_id        uuid not null references profiles(id) on delete cascade,
  location_id     uuid references locations(id) on delete set null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  role_label      text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists idx_staff_shifts_org  on staff_shifts(organization_id, starts_at desc);
create index if not exists idx_staff_shifts_staff on staff_shifts(staff_id);
drop trigger if exists trg_staff_shifts_updated on staff_shifts;
create trigger trg_staff_shifts_updated before update on staff_shifts
  for each row execute function set_updated_at();

-- ---------- tasks ----------
create table if not exists tasks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title           text not null,
  description     text,
  assigned_to     uuid references profiles(id) on delete set null,
  created_by      uuid references profiles(id) on delete set null,
  due_date        date,
  priority        text not null default 'normal',
  status          task_status not null default 'open',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_tasks_org      on tasks(organization_id);
create index if not exists idx_tasks_assignee on tasks(assigned_to);
drop trigger if exists trg_tasks_updated on tasks;
create trigger trg_tasks_updated before update on tasks
  for each row execute function set_updated_at();

create or replace function tasks_emit_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
    values (new.organization_id, auth.uid(), 'task.created', 'task', new.id,
            jsonb_build_object('title', new.title, 'assigned_to', new.assigned_to));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
    values (new.organization_id, auth.uid(), 'task.status_changed', 'task', new.id,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;
drop trigger if exists trg_tasks_emit_insert on tasks;
create trigger trg_tasks_emit_insert after insert on tasks for each row execute function tasks_emit_events();
drop trigger if exists trg_tasks_emit_update on tasks;
create trigger trg_tasks_emit_update after update on tasks for each row execute function tasks_emit_events();

-- ---------- internal_messages (staff-to-staff) ----------
create table if not exists internal_messages (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  from_user       uuid not null references profiles(id) on delete cascade,
  to_user         uuid not null references profiles(id) on delete cascade,
  body            text not null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_internal_messages_to on internal_messages(to_user, created_at desc);
create index if not exists idx_internal_messages_org on internal_messages(organization_id);

-- ---------- staff_certifications ----------
create table if not exists staff_certifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  staff_id        uuid not null references profiles(id) on delete cascade,
  name            text not null,
  issuer          text,
  issued_on       date,
  expires_on      date,
  created_at      timestamptz not null default now()
);
create index if not exists idx_staff_cert_org on staff_certifications(organization_id, expires_on);

-- ---------- RLS (A5) ----------
alter table staff_shifts enable row level security;
alter table tasks enable row level security;
alter table internal_messages enable row level security;
alter table staff_certifications enable row level security;

drop policy if exists staff_shifts_select on staff_shifts;
create policy staff_shifts_select on staff_shifts for select using (organization_id in (select auth_org_ids()));
drop policy if exists staff_shifts_write on staff_shifts;
create policy staff_shifts_write on staff_shifts for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

drop policy if exists tasks_select on tasks;
create policy tasks_select on tasks for select using (organization_id in (select auth_org_ids()));
drop policy if exists tasks_write on tasks;
create policy tasks_write on tasks for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]));

-- messages: sender or recipient may read; only the sender (in their org) may write.
drop policy if exists internal_messages_select on internal_messages;
create policy internal_messages_select on internal_messages for select
  using (organization_id in (select auth_org_ids()) and (from_user = auth.uid() or to_user = auth.uid()));
drop policy if exists internal_messages_insert on internal_messages;
create policy internal_messages_insert on internal_messages for insert
  with check (organization_id in (select auth_org_ids()) and from_user = auth.uid());
drop policy if exists internal_messages_update on internal_messages;
create policy internal_messages_update on internal_messages for update
  using (to_user = auth.uid());  -- recipient marks read

drop policy if exists staff_cert_select on staff_certifications;
create policy staff_cert_select on staff_certifications for select using (organization_id in (select auth_org_ids()));
drop policy if exists staff_cert_write on staff_certifications;
create policy staff_cert_write on staff_certifications for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

-- End of 0025_team_ops.sql
