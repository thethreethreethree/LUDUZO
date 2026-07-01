-- ============================================================================
-- LUDUZO — Phase 4: QR check-in & occupancy. Builds on 0001 + 0002.
--
-- Governed by: CLAUDE.md §1.5.1 layer 1 · §1.7 · §3.1 (attendance events) ·
--   A12 (safe-to-re-run) · A5 (RLS ripple).
--
-- Model: each member gets a stable qr_token; a kiosk/staff scan looks the member
-- up by token (RLS-scoped to the gym) and records a checkin. Live occupancy =
-- count of checkins with checked_out_at IS NULL.
--
-- FLAGGED: the QR token here is a plain unguessable id (gen_random_uuid). Signed/
-- expiring QR (HMAC) is a future hardening — flagged, not blocking.
--
-- STATUS: UNTESTED until run. A12: all objects guarded.
-- ============================================================================

-- ---------- members.qr_token (stable per-member scan id) ----------
alter table members add column if not exists qr_token text;
alter table members alter column qr_token set default gen_random_uuid()::text;
update members set qr_token = gen_random_uuid()::text where qr_token is null;
create unique index if not exists uq_members_qr_token on members(qr_token);

-- ---------- checkins ----------
create table if not exists checkins (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  location_id     uuid references locations(id) on delete set null,
  checked_in_at   timestamptz not null default now(),
  checked_out_at  timestamptz,
  method          text not null default 'kiosk',
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_checkins_org          on checkins(organization_id);
create index if not exists idx_checkins_org_open     on checkins(organization_id) where checked_out_at is null;
create index if not exists idx_checkins_member       on checkins(member_id);
create index if not exists idx_checkins_org_time     on checkins(organization_id, checked_in_at desc);
drop trigger if exists trg_checkins_updated on checkins;
create trigger trg_checkins_updated before update on checkins
  for each row execute function set_updated_at();

-- ---------- Append-only attendance events (§3.1) ----------
create or replace function checkins_emit_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
    values (new.organization_id, auth.uid(), 'member.checkin', 'member', new.member_id,
            jsonb_build_object('checkin_id', new.id, 'location_id', new.location_id, 'method', new.method));
  elsif tg_op = 'UPDATE' and old.checked_out_at is null and new.checked_out_at is not null then
    insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
    values (new.organization_id, auth.uid(), 'member.checkout', 'member', new.member_id,
            jsonb_build_object('checkin_id', new.id));
  end if;
  return new;
end$$;
drop trigger if exists trg_checkins_emit_insert on checkins;
create trigger trg_checkins_emit_insert after insert on checkins
  for each row execute function checkins_emit_events();
drop trigger if exists trg_checkins_emit_update on checkins;
create trigger trg_checkins_emit_update after update on checkins
  for each row execute function checkins_emit_events();

-- ---------- RLS (tenant read; staff write) ----------
alter table checkins enable row level security;
drop policy if exists checkins_select on checkins;
create policy checkins_select on checkins for select
  using (organization_id in (select auth_org_ids()));
drop policy if exists checkins_write on checkins;
create policy checkins_write on checkins for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]));

-- End of 0006_checkins.sql
