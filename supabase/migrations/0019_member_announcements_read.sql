-- ============================================================================
-- LUDUZO — let linked members read their gym's announcements (portal).
-- Builds on 0009 (announcements) + 0015 (member linkage).
--
-- announcements_select (0009) is staff/org-scoped (auth_org_ids), which excludes
-- customers who are members but not org staff. This adds a member-scoped read:
-- a customer linked to a member row in an org may read that org's announcements.
-- Additive permissive policy (OR'd with the staff policy). §3.6 / A10.
--
-- Governed by: CLAUDE.md §1.5.1 L1 · A5 · A12. UNTESTED until run.
-- ============================================================================

-- Orgs where the caller is a linked member (SECURITY DEFINER; no recursion).
create or replace function auth_member_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct organization_id from members where profile_id = auth.uid();
$$;
grant execute on function auth_member_org_ids() to authenticated;

drop policy if exists announcements_select_member on announcements;
create policy announcements_select_member on announcements for select
  using (published and organization_id in (select auth_member_org_ids()));

-- End of 0019_member_announcements_read.sql
