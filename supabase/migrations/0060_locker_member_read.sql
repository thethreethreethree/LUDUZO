-- ============================================================================
-- LUDUZO — Members can read their OWN locker rental (§ member portal, cat 3).
--
-- Governed by: §3.2 (RLS) · A5 (ripple-trace) · A10 (the member sees their own
--   data) · A12 (safe-to-rerun).
--
-- locker_rentals (0029) was staff-only (org-scoped select + staff write). The member
-- portal had no way to show a member their own locker. This adds a member-read
-- policy so the portal "Your locker" card can render. RLS SELECT policies are
-- PERMISSIVE (OR'd), so this is purely additive — the existing staff org-scoped
-- select is unaffected (A5 ripple-trace: no other locker read-site changes behavior;
-- write stays staff-only).
--
-- ⚠ STATUS: authored while iterating; UNAPPLIED until run via the SQL editor. The
-- portal "Your locker" card degrades gracefully (renders nothing) until then.
-- ============================================================================

drop policy if exists locker_rentals_member_read on locker_rentals;
create policy locker_rentals_member_read on locker_rentals for select
  using (member_id in (select auth_member_ids()));

-- End of 0060_locker_member_read.sql
