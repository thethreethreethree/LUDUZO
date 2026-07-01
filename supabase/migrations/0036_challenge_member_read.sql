-- ============================================================================
-- LUDUZO — Member read access for challenges + own participation (portal).
--
-- Governed by: §1.5.1 L3 (workflow continuity) · §3.2 (RLS is the guarantee) ·
--   A5 (ripple) · A12 (guarded).
--
-- WHY: 0034 added challenge_participants_member_insert (a member can JOIN a
-- challenge) but 0026 only gave STAFF read on `challenges` and
-- `challenge_participants`. So a member could join a challenge yet never SEE the
-- challenge list to join from, nor confirm they had joined or view their progress
-- — a half-built surface (join with no read = broken layer-3 continuity, exactly
-- the §1.5.2 proactive-audit failure mode). This closes the read side so the join
-- feature is actually usable end-to-end.
--
-- Own-scope only (a member sees THEIR participation, not others') — consistent
-- with every other member-facing policy. A cross-member leaderboard would need a
-- deliberate aggregate/anonymized read and is intentionally not granted here.
-- ============================================================================

-- Members read the challenges offered by their gym (to browse + join).
drop policy if exists challenges_select_member on challenges;
create policy challenges_select_member on challenges for select
  using (organization_id in (select auth_member_org_ids()));

-- Members read their OWN participation rows (joined? current progress?).
drop policy if exists challenge_participants_select_own on challenge_participants;
create policy challenge_participants_select_own on challenge_participants for select
  using (member_id in (select auth_member_ids()));

-- End of 0036_challenge_member_read.sql
