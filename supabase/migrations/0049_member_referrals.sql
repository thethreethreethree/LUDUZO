-- ============================================================================
-- LUDUZO — Member-facing referrals (§9): a member refers a friend by name/email.
--
-- Governed by: §3.2 (RLS structural) · §1.5.1 L3 · A5 · A12.
-- The referrals table (0003) is referrer_member_id + referred_name/email + status.
-- This lets a member CREATE a referral attributed to themselves and READ their own
-- referrals' status. Staff policies (0003) unchanged; these are additive.
--
-- ⚠ STATUS: authored while the direct-Postgres host was unreachable — UNAPPLIED.
-- Apply via the Supabase SQL editor. The /more referral UI degrades gracefully
-- (empty list; insert maps a missing-policy denial to a friendly message).
-- ============================================================================

drop policy if exists referrals_member_insert on referrals;
create policy referrals_member_insert on referrals for insert
  with check (referrer_member_id in (select auth_member_ids())
              and organization_id in (select auth_member_org_ids()));

drop policy if exists referrals_member_read_own on referrals;
create policy referrals_member_read_own on referrals for select
  using (referrer_member_id in (select auth_member_ids()));

-- End of 0049_member_referrals.sql
