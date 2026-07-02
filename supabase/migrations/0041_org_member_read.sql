-- ============================================================================
-- LUDUZO — Let linked members read their OWN gym's organization row (portal).
--
-- Governed by: §1.5.1 L3 (composition) · §3.2 · A5 · A12. [Assets re-read from
-- ThinkerThinker.md in-session 2026-07-02.]
--
-- WHY (F1-class gap): org_select (0001) is `using (id in auth_org_ids())` — STAFF
-- only. A pure member is not in organization_members, so they cannot read their
-- gym's organizations row. Every member-portal surface that embeds the org name
-- (`members → organization:organizations(name)`) therefore gets NULL and falls back
-- to the literal "your gym" (portal/more, portal/help). Members never see their
-- actual gym name — the same silent-embed-null failure as class details / trainer
-- names. This adds an additive member-scoped read (OR'd with the staff policy).
--
-- Scope: the org row is name/slug/status/settings — none sensitive to a member of
-- that gym (name/slug are member-facing; settings is white-label branding). No
-- cross-tenant exposure: bound to auth_member_org_ids() (the caller's own gyms).
-- ============================================================================

drop policy if exists org_select_member on organizations;
create policy org_select_member on organizations for select
  using (id in (select auth_member_org_ids()));

-- End of 0041_org_member_read.sql
