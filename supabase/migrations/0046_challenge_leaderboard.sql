-- ============================================================================
-- LUDUZO — Challenge leaderboard (§9), member-readable.
--
-- Governed by: §3.2 · §1.5.1 L3 · A20 (ship the decided default) · A12.
-- Builds on the founder's first-name-visibility decision (0044): a leaderboard
-- exposing per-challenge (first_name, progress) for challenges in the caller's own
-- gym. Definer view (security_invoker=false) bypasses the own-row limit of
-- challenge_participants (0036) so a member can see co-participants' standings;
-- WHERE scopes to auth_member_org_ids(); columns are first_name + progress only
-- (no last name / PII), consistent with the member-directory decision.
--
-- ⚠ STATUS: authored while the direct-Postgres host was unreachable — UNAPPLIED /
-- UNVERIFIED. The Progress leaderboard degrades gracefully (no rows) until applied.
-- Apply via the Supabase SQL editor or the runner when the host resolves.
-- ============================================================================

create or replace view challenge_leaderboard
with (security_invoker = false) as
  select cp.challenge_id,
         cp.member_id,
         m.first_name,
         cp.progress
  from challenge_participants cp
  join members m    on m.id = cp.member_id
  join challenges c on c.id = cp.challenge_id
  where c.organization_id in (select auth_member_org_ids());

grant select on challenge_leaderboard to authenticated;

-- End of 0046_challenge_leaderboard.sql
