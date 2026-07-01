-- ============================================================================
-- LUDUZO — let linked members see their own group memberships (portal).
-- Builds on 0003 (member_groups, member_group_links) + 0015 (auth_member_ids)
-- + 0019 (auth_member_org_ids). Additive own/member-scoped read policies. A10.
--
-- Governed by: CLAUDE.md §1.5.1 L1 · A5 · A12. UNTESTED until run.
-- ============================================================================

-- a member sees their own group-link rows
drop policy if exists member_group_links_select_own on member_group_links;
create policy member_group_links_select_own on member_group_links for select
  using (member_id in (select auth_member_ids()));

-- a member may read groups in a gym where they are a member (names, not sensitive)
drop policy if exists member_groups_select_member on member_groups;
create policy member_groups_select_member on member_groups for select
  using (organization_id in (select auth_member_org_ids()));

-- End of 0023_group_member_read.sql
