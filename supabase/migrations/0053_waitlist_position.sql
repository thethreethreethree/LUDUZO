-- ============================================================================
-- LUDUZO — Member's own waitlist position for a session (§4).
--
-- Governed by: §3.2 (members can't read others' bookings, 0022) · §1.5.1 L2 · A12.
-- Returns the caller's rank among waitlisted bookings for a session (1 = next in
-- line), or null if they're not waitlisted for it. SECURITY DEFINER because the
-- count spans other members' bookings, which the member can't read directly. No
-- per-member data is exposed — only the caller's own position number.
--
-- ⚠ STATUS: authored while the direct-Postgres host was unreachable — UNAPPLIED.
-- Apply via the Supabase SQL editor. The book page hides the position until then.
-- ============================================================================

create or replace function my_waitlist_position(p_session_id uuid)
returns integer
language sql stable security definer set search_path = public as $$
  with me as (
    select created_at from bookings
    where session_id = p_session_id and status = 'waitlisted'
      and member_id in (select auth_member_ids())
    limit 1
  )
  select case when exists (select 1 from me) then
    (select count(*)::int + 1
       from bookings b, me
      where b.session_id = p_session_id and b.status = 'waitlisted'
        and b.created_at < me.created_at)
  else null end;
$$;

grant execute on function my_waitlist_position(uuid) to authenticated;

-- End of 0053_waitlist_position.sql
