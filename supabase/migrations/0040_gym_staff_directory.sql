-- ============================================================================
-- LUDUZO — Member-safe staff name directory (fixes F-C trainer-name gap).
--
-- Governed by: §2 (interrogate locked doors — find the better room, don't pick
--   the lock) · §1.5.1 L3 (composition) · A20 (ship the safe default, don't defer)
--   · §3.2 · A12. [Assets re-read from ThinkerThinker.md in-session 2026-07-02.]
--
-- WHY: members cannot read staff `profiles` rows — profile_comember_read (0001)
-- gates on auth_shares_org_with(), which requires BOTH parties to be in
-- organization_members (i.e. both staff). A pure member shares no org there, so
-- every `trainer:profiles(full_name)` embed on the member portal returns null and
-- PT sessions show no trainer name (an F1-class silent gap).
--
-- The locked door is REAL: `profiles` also holds staff email/phone, which members
-- should not read wholesale. The better room (§2) is a projection exposing ONLY
-- full_name + avatar_url for active staff of the caller's own gym — never contact
-- PII. This is a definer view (security_invoker=false) so it bypasses the caller's
-- RLS on the base tables, with the WHERE clause as the tenant guard: a member sees
-- only staff of orgs THEY are a member of (auth_member_org_ids()). A user who is
-- neither member nor staff of an org sees nothing.
-- ============================================================================

create or replace view gym_staff_directory
with (security_invoker = false) as
  select om.organization_id,
         om.user_id,
         p.full_name,
         p.avatar_url
  from organization_members om
  join profiles p on p.id = om.user_id
  where om.status = 'active'
    and om.organization_id in (select auth_member_org_ids());

grant select on gym_staff_directory to authenticated;

-- End of 0040_gym_staff_directory.sql
