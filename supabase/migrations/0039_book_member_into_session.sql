-- ============================================================================
-- LUDUZO — Staff books a member into a class session (parity with 0038).
--
-- Governed by: A21 (same concept across modules must reach parity) · §1.5.1 L3
--   (synergetic composition) · §3.2 (authorization is structural) · §3.1 (events
--   via existing booking triggers) · A12 (guarded). [Assets re-read from
--   ThinkerThinker.md in-session on 2026-07-02 during the audit that produced this
--   fix — A22 session-read discipline.]
--
-- WHY: 0038 gave MEMBERS an atomic self-book (capacity→waitlist + revive a
-- cancelled row). The STAFF path (dashboard/classes createBooking) still did a
-- plain insert, so it reproduced the two bugs 0038 fixed for members:
--   1. Re-book after cancel: unique(session_id, member_id) rejects the insert
--      (23505) and the UI falsely says "already booked" — staff cannot re-book a
--      member who cancelled.
--   2. No waitlist: a full session raises 23514 and staff just get an error;
--      members meanwhile can waitlist. Same concept, divergent behavior (A21).
-- This RPC brings the staff path to parity: same capacity/waitlist/revive logic,
-- authorized to STAFF of the session's org (not the caller's own membership).
--
-- Distinct from book_my_session because staff book OTHER members: the caller is
-- authorized by org ROLE (auth_has_org_role), and the member is passed explicitly
-- rather than resolved from auth.uid().
-- ============================================================================

create or replace function book_member_into_session(p_session_id uuid, p_member_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_org    uuid;
  v_cap    integer;
  v_count  integer;
  v_status text;
  v_existing bookings%rowtype;
begin
  if auth.uid() is null then
    raise exception 'book_member_into_session: not authenticated';
  end if;

  -- Lock the session (serialize concurrent bookers) and get its org.
  select cs.organization_id into v_org
  from class_sessions cs
  where cs.id = p_session_id
  for update;
  if v_org is null then
    raise exception 'book_member_into_session: class not found';
  end if;

  -- Authorization: the caller must be booking-capable STAFF of the session's org.
  if not auth_has_org_role(v_org, array['owner','admin','manager','front_desk']::app_role[]) then
    raise exception 'book_member_into_session: not authorized for this gym';
  end if;

  -- The target member must belong to the SAME org (no cross-tenant booking).
  if not exists (select 1 from members m where m.id = p_member_id and m.organization_id = v_org) then
    raise exception 'book_member_into_session: member not in this gym';
  end if;

  select coalesce(cs.capacity, c.capacity) into v_cap
  from class_sessions cs join classes c on c.id = cs.class_id
  where cs.id = p_session_id;

  select count(*) into v_count
  from bookings
  where session_id = p_session_id and status in ('booked','attended');

  v_status := case when v_cap is not null and v_count >= v_cap then 'waitlisted' else 'booked' end;

  select * into v_existing
  from bookings
  where session_id = p_session_id and member_id = p_member_id;

  if found then
    if v_existing.status in ('booked','waitlisted','attended') then
      return v_existing.status;              -- already active → idempotent
    end if;
    update bookings set status = v_status::booking_status where id = v_existing.id;  -- revive cancelled/no_show
  else
    insert into bookings (organization_id, session_id, member_id, status)
    values (v_org, p_session_id, p_member_id, v_status::booking_status);
  end if;

  return v_status;
end $$;

grant execute on function book_member_into_session(uuid, uuid) to authenticated;

-- End of 0039_book_member_into_session.sql
