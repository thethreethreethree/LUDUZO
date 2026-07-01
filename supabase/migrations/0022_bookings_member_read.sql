-- ============================================================================
-- LUDUZO — let linked members read their own class bookings (portal).
-- Builds on 0007 (bookings) + 0015 (auth_member_ids). Additive own-read policy
-- (OR'd with the staff policy). §3.6 / A10.
--
-- Governed by: CLAUDE.md §1.5.1 L1 · A5 · A12. UNTESTED until run.
-- ============================================================================

drop policy if exists bookings_select_own on bookings;
create policy bookings_select_own on bookings for select
  using (member_id in (select auth_member_ids()));

-- End of 0022_bookings_member_read.sql
