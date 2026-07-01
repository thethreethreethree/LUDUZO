-- ============================================================================
-- LUDUZO — Phase 5: enforce class session capacity (no overbooking).
-- Builds on 0007 (classes/class_sessions/bookings).
--
-- A booking is rejected if the session is already at capacity. Effective capacity
-- is the session's own capacity, else the parent class's capacity (NULL = unlimited).
-- Counts only active holds ('booked','attended'); cancelled/no_show free a slot.
--
-- Governed by: CLAUDE.md §1.5.1 layer 2 (the rule actually works) · §1.7 · A12.
-- STATUS: UNTESTED until run. A12: create-or-replace + guarded trigger.
-- ============================================================================

create or replace function bookings_enforce_capacity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cap integer;
  v_count integer;
begin
  select coalesce(cs.capacity, c.capacity) into v_cap
  from class_sessions cs
  join classes c on c.id = cs.class_id
  where cs.id = new.session_id;

  if v_cap is not null then
    select count(*) into v_count
    from bookings
    where session_id = new.session_id and status in ('booked','attended');

    if v_count >= v_cap then
      raise exception 'session is full (capacity %)', v_cap using errcode = 'check_violation';
    end if;
  end if;

  return new;
end$$;

drop trigger if exists trg_bookings_capacity on bookings;
create trigger trg_bookings_capacity before insert on bookings
  for each row execute function bookings_enforce_capacity();

-- End of 0012_booking_capacity.sql
