-- ============================================================================
-- LUDUZO — Atomic member self-booking RPC (fixes the re-book-after-cancel bug).
--
-- Governed by: §1.5.1 L2 (does it actually work) · §1.6 (close the loop) ·
--   §3.1 (events via the existing booking triggers) · §3.2 · A12.
--
-- BUG THIS FIXES: bookings has unique(session_id, member_id). When a member
-- cancels, the row is set to 'cancelled' (not deleted). A later re-book attempt
-- then (a) collides on the unique index (23505) if it inserts, and (b) CANNOT be
-- revived by the member via UPDATE, because the 0034 F2 with_check restricts a
-- member update to result-status 'cancelled' only. Net effect: cancel was a
-- permanent, irreversible action — a member could never re-book a session they
-- had cancelled. The client-side try/'booked'/retry-'waitlisted' logic could not
-- see this (it can't read a cancelled sibling row's implications), and reported a
-- misleading "already booked".
--
-- FIX: a SECURITY DEFINER RPC that runs authoritatively:
--   * resolves the caller's member row IN THE SESSION'S ORG (cross-org guard),
--   * locks the session row to serialize concurrent bookers (no capacity TOCTOU),
--   * counts consuming bookings to decide 'booked' vs 'waitlisted',
--   * REVIVES a prior cancelled row (or a no_show) or inserts fresh,
--   * is idempotent if already active (returns the current status).
-- auth.uid() is unchanged inside a definer function, so the existing booking
-- event triggers still attribute the event to the acting member (§3.1).
-- ============================================================================

create or replace function book_my_session(p_session_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_org    uuid;
  v_member uuid;
  v_cap    integer;
  v_count  integer;
  v_status text;
  v_existing bookings%rowtype;
begin
  if v_uid is null then
    raise exception 'book_my_session: not authenticated';
  end if;

  -- Lock the session row: serializes concurrent bookers so the capacity count
  -- below can't race two members into the last 'booked' slot.
  select cs.organization_id into v_org
  from class_sessions cs
  where cs.id = p_session_id
  for update;
  if v_org is null then
    raise exception 'book_my_session: class not found';
  end if;

  -- The caller's member row in THIS session's org (cross-org guard).
  select id into v_member
  from members
  where profile_id = v_uid and organization_id = v_org
  limit 1;
  if v_member is null then
    raise exception 'book_my_session: no membership in this gym';
  end if;

  -- Capacity (session overrides class default); null = unlimited.
  select coalesce(cs.capacity, c.capacity) into v_cap
  from class_sessions cs join classes c on c.id = cs.class_id
  where cs.id = p_session_id;

  select count(*) into v_count
  from bookings
  where session_id = p_session_id and status in ('booked','attended');

  v_status := case when v_cap is not null and v_count >= v_cap then 'waitlisted' else 'booked' end;

  select * into v_existing
  from bookings
  where session_id = p_session_id and member_id = v_member;

  if found then
    -- Already actively booked/waitlisted → idempotent no-op.
    if v_existing.status in ('booked','waitlisted') then
      return v_existing.status;
    end if;
    -- Revive a cancelled / no_show row (this is the re-book path the member
    -- could not take through RLS). Cast: v_status is text, the column is the
    -- booking_status enum (a text VARIABLE needs an explicit cast).
    update bookings set status = v_status::booking_status where id = v_existing.id;
  else
    insert into bookings (organization_id, session_id, member_id, status)
    values (v_org, p_session_id, v_member, v_status::booking_status);
  end if;

  return v_status;
end $$;

grant execute on function book_my_session(uuid) to authenticated;

-- End of 0038_book_my_session.sql
