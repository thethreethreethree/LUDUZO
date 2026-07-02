-- ============================================================================
-- LUDUZO — Add role to gym_staff_directory so members see who's a trainer, etc (§6).
--
-- Governed by: §3.2 · §1.5.1 L3 · A12. Additive column on the existing 0040 view
-- (CREATE OR REPLACE appends the new column at the end — existing consumers that
-- select user_id/full_name are unaffected). Still name/avatar/role only, no PII.
--
-- ⚠ STATUS: authored while the direct-Postgres host was unreachable — UNAPPLIED.
-- Apply via the Supabase SQL editor. "Meet the team" shows names until applied.
-- ============================================================================

create or replace view gym_staff_directory
with (security_invoker = false) as
  select om.organization_id,
         om.user_id,
         p.full_name,
         p.avatar_url,
         om.role::text as role
  from organization_members om
  join profiles p on p.id = om.user_id
  where om.status = 'active'
    and om.organization_id in (select auth_member_org_ids());

grant select on gym_staff_directory to authenticated;

-- End of 0052_staff_directory_role.sql
