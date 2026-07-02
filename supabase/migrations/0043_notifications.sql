-- ============================================================================
-- LUDUZO — In-app member notifications + waitlist spot-opened alert.
--
-- Governed by: §3.6 (make change visible) · §1.6 (close the loop) · §3.1 (events) ·
--   §3.2 · A5 · A12. [Assets re-read in-session 2026-07-02.]
--
-- WHY: the waitlist auto-promotion trigger (0024) silently flips the oldest
-- waitlisted booking to 'booked' when a seat frees — the member is never told they
-- got in (a §3.6 visibility gap; the founder's list §10 "waitlist spot-opened
-- alert"). This adds an in-app notifications inbox (no push infra needed) and emits
-- a notification on promotion. Additional event types can reuse the same table.
--
-- RLS: a member reads + marks-read their OWN notifications; staff may read their
-- org's. Writes come from SECURITY DEFINER triggers, not directly from members
-- (except marking read).
-- ============================================================================

create table if not exists notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  kind            text not null,
  title           text not null,
  body            text,
  link            text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_notifications_member on notifications(member_id, created_at desc);

alter table notifications enable row level security;

drop policy if exists notifications_select_own on notifications;
create policy notifications_select_own on notifications for select
  using (member_id in (select auth_member_ids()));

drop policy if exists notifications_update_own on notifications;
create policy notifications_update_own on notifications for update
  using (member_id in (select auth_member_ids()))
  with check (member_id in (select auth_member_ids()));

drop policy if exists notifications_select_staff on notifications;
create policy notifications_select_staff on notifications for select
  using (organization_id in (select auth_org_ids()));

-- ---- Emit a notification when a member is auto-promoted off the waitlist ----
-- Extends 0024's promote function: same promotion logic, plus an in-app alert to
-- the promoted member. SECURITY DEFINER so the insert bypasses the member's RLS.
create or replace function bookings_promote_waitlist()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cap integer;
  v_count integer;
  v_next_id uuid;
  v_next_member uuid;
  v_class text;
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
  select id, member_id into v_next_id, v_next_member from bookings
    where session_id = new.session_id and status = 'waitlisted'
    order by created_at asc limit 1;
  if v_next_id is not null then
    update bookings set status = 'booked' where id = v_next_id;
    select c.name into v_class
      from class_sessions cs join classes c on c.id = cs.class_id
      where cs.id = new.session_id;
    insert into notifications (organization_id, member_id, kind, title, body, link)
    values (new.organization_id, v_next_member, 'waitlist_promoted',
            'A spot opened — you''re in!',
            'You were moved off the waitlist into ' || coalesce(v_class, 'your class') || '.',
            '/portal/book');
  end if;
  return new;
end $$;

-- End of 0043_notifications.sql
