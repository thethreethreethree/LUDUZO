-- ============================================================================
-- LUDUZO — Class availability ("spots left") for members (§4).
--
-- Governed by: §3.2 (members can't read others' bookings, 0022) · §1.5.1 L2 · A12.
-- Members book blind today — they only learn a class is full after trying. This
-- definer view exposes, per upcoming session in the caller's gym, the consuming
-- booked count + capacity — an AGGREGATE only (no member identities). One view, not
-- N per-session calls (audit Finding 2 lesson). WHERE scopes to auth_member_org_ids().
--
-- ⚠ STATUS: authored while the direct-Postgres host was unreachable — UNAPPLIED.
-- Apply via the Supabase SQL editor. The schedule hides "spots left" until then.
-- ============================================================================

create or replace view class_session_availability
with (security_invoker = false) as
  select cs.id as session_id,
         coalesce(cs.capacity, c.capacity) as capacity,
         (select count(*)::int from bookings b
            where b.session_id = cs.id and b.status in ('booked','attended')) as booked
  from class_sessions cs
  join classes c on c.id = cs.class_id
  where cs.organization_id in (select auth_member_org_ids());

grant select on class_session_availability to authenticated;

-- End of 0054_class_session_availability.sql
