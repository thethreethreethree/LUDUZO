-- ============================================================================
-- LUDUZO — Member-facing live occupancy ("busy / quiet"), §3.
--
-- Governed by: §3.2 (RLS — members can't read all checkins) · §1.5.1 L2 · A12.
-- Members may only read their OWN checkins (0015/0022), so they cannot count
-- org-wide occupancy. This SECURITY DEFINER function returns just the aggregate
-- (open-checkin count + total capacity) for the CALLER'S OWN gym — no per-member
-- rows exposed. Read-only.
--
-- ⚠ STATUS: authored while the direct-Postgres host was unreachable — UNAPPLIED.
-- Apply via the Supabase SQL editor. The home indicator hides gracefully until then.
-- ============================================================================

create or replace function member_gym_occupancy()
returns table(occupancy integer, capacity integer)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from checkins ci
       where ci.organization_id = o.id and ci.checked_out_at is null),
    coalesce((select sum(l.capacity)::int from locations l where l.organization_id = o.id), 0)
  from (select organization_id as id from members where profile_id = auth.uid() limit 1) o;
$$;

grant execute on function member_gym_occupancy() to authenticated;

-- End of 0048_member_gym_occupancy.sql
