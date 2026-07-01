-- ============================================================================
-- LUDUZO — Fix found by the F3 smoke test (audit remediation).
--
-- BUG: bookings_enforce_capacity (0012) ran on EVERY insert regardless of the new
--   row's status, so a 'waitlisted' booking was rejected once the session was full
--   — defeating the waitlist feature (0024). §1.5.1 L2 (it did not actually work).
--
-- FIX: only enforce capacity for capacity-CONSUMING statuses ('booked','attended');
--   'waitlisted'/'cancelled'/'no_show' inserts are exempt. Exclude the row itself
--   from the count for safety. A12: create-or-replace.
-- ============================================================================

create or replace function bookings_enforce_capacity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cap integer;
  v_count integer;
begin
  -- Non-consuming statuses never count against capacity — allow them (waitlist!).
  if new.status not in ('booked','attended') then
    return new;
  end if;

  select coalesce(cs.capacity, c.capacity) into v_cap
  from class_sessions cs
  join classes c on c.id = cs.class_id
  where cs.id = new.session_id;

  if v_cap is not null then
    select count(*) into v_count
    from bookings
    where session_id = new.session_id
      and status in ('booked','attended')
      and id <> new.id;

    if v_count >= v_cap then
      raise exception 'session is full (capacity %)', v_cap using errcode = 'check_violation';
    end if;
  end if;

  return new;
end$$;

-- End of 0032_waitlist_capacity_fix.sql
