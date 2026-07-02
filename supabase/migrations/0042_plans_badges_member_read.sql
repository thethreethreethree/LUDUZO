-- ============================================================================
-- LUDUZO — Member read for plans + badges catalogs (closes the F1 member-read class).
--
-- Governed by: A13 (recurring miss → author the whole space, not one item) ·
--   §1.5.1 L3 · §3.2 · A5 · A12. [Assets re-read in-session 2026-07-02.]
--
-- WHY: this is the THIRD＋ instance of the same silent-embed-null class —
--   0034 (classes/sessions), 0040 (staff names), 0041 (org name). A13 says stop
--   patching per-item and close the category. A full sweep of every table the
--   member portal reads/embeds found the last two staff-only catalogs:
--     * plans  — subscription.plan.name embed → NULL → portal shows "Plan"
--     * badges — member_badges.badge.(name,icon) embed → NULL → shows "🏅 Badge"
--   Every other member-embedded table already has a member-scoped read policy
--   (verified: members, subscriptions, checkins, loyalty, bookings, classes,
--   documents, invoices, appointments, workout/meal plans, measurements,
--   member_badges, challenges/participants, community, announcements, org,
--   gym_staff_directory). After this, the member-read space is complete.
--
-- Both are org-level catalogs (plan names, badge names/icons) — no PII; scoped to
-- the caller's own gym via auth_member_org_ids(). Additive (OR'd with staff policy).
-- ============================================================================

drop policy if exists plans_select_member on plans;
create policy plans_select_member on plans for select
  using (organization_id in (select auth_member_org_ids()));

drop policy if exists badges_select_member on badges;
create policy badges_select_member on badges for select
  using (organization_id in (select auth_member_org_ids()));

-- End of 0042_plans_badges_member_read.sql
