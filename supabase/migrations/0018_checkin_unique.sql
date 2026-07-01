-- ============================================================================
-- LUDUZO — Phase 4 hardening: at most one OPEN check-in per member.
-- Builds on 0006 (checkins). Race-proof DB guarantee (the app-level guard in the
-- check-in actions is belt-and-suspenders; this is the actual invariant).
--
-- Governed by: CLAUDE.md §1.5.1 L2 (the rule actually holds) · §1.7 · A12.
-- STATUS: UNTESTED until run.
-- ============================================================================

-- A partial unique index: unique on member_id only among rows not yet checked out.
create unique index if not exists uq_checkins_open_member
  on checkins(member_id) where checked_out_at is null;

-- End of 0018_checkin_unique.sql
