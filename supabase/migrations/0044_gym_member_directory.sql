-- ============================================================================
-- LUDUZO — Member first-name directory (accepted rec #5: member-to-member visibility).
--
-- Governed by: §3.2 · §1.5.1 L3 · A20 (ship the decided default) · A12.
-- Founder decision (2026-07-02): member-to-member visibility = FIRST NAME ONLY,
-- same gym. This mirrors gym_staff_directory (0040) but for members, exposing ONLY
-- first_name — no last name, email, phone, or DOB. Enables community member-comment
-- attribution and (later) leaderboards, without leaking member PII.
--
-- Definer view (security_invoker=false) so it bypasses the caller's RLS on members;
-- the WHERE clause is the tenant guard: a member sees only first names of members
-- in orgs THEY belong to (auth_member_org_ids()).
--
-- ⚠ STATUS: authored while the direct-Postgres host was unreachable — UNAPPLIED /
-- UNVERIFIED. Apply via the Supabase SQL editor or the runner once the host
-- resolves. The /more UI degrades gracefully until then (member comments render
-- without a name, as before). A12: guarded.
-- ============================================================================

create or replace view gym_member_directory
with (security_invoker = false) as
  select m.organization_id,
         m.id as member_id,
         m.first_name
  from members m
  where m.organization_id in (select auth_member_org_ids());

grant select on gym_member_directory to authenticated;

-- End of 0044_gym_member_directory.sql
