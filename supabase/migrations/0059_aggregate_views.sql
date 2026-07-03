-- ============================================================================
-- LUDUZO — Server-side aggregate views (the A13 cure for aggregate-over-capped-fetch).
--
-- Governed by: §3.2 (RLS via WHERE-guarded definer views) · A13 (author the SPACE
--   once, not a limit-raise per page) · A12 (safe-to-rerun) · §3.4 (a "total" must
--   be a true total, not a capped sum mislabelled).
--
-- Across the 2026-07 audit the same defect recurred: a balance/total computed by
-- summing a `.limit(N)` row fetch, shown as if complete. The pages were patched by
-- raising N — A13 says that's the wrong fix (patch-per-instance); the cure is a
-- single server-side aggregate the pages read. These two views are that cure.
--
--   1. member_points_balance — a member's TRUE loyalty balance (sum of ALL their
--      loyalty_transactions), replacing the per-page `.limit(2000)` sums in the
--      portal (home, /more) and the staff member-detail view.
--   2. gym_revenue_summary  — a gym's TRUE lifetime paid revenue + outstanding,
--      replacing reports' capped `.limit(5000)` paid-invoice sum.
--
-- Both are definer views (security_invoker=false) so they bypass the caller's RLS
-- on the base tables; the WHERE clause is the tenant guard (pattern from 0040/0044).
--
-- ⚠ STATUS: authored while the direct-Postgres host was unreachable — UNAPPLIED /
-- UNVERIFIED. Apply via the Supabase SQL editor. The consuming pages are NOT yet
-- rewired to these views (that rewire is gated on applying + verifying them first,
-- per the verify-before-claim discipline); until then the existing limit-based sums
-- stay live and correct for realistic volumes. A12: create-or-replace, re-runnable.
-- ============================================================================

-- 1. Member loyalty balance (true sum). A member sees their own rows; staff see
--    every member's balance in orgs they belong to.
create or replace view member_points_balance
with (security_invoker = false) as
  select lt.member_id,
         lt.organization_id,
         coalesce(sum(lt.points), 0)::int as balance
  from loyalty_transactions lt
  where lt.member_id in (select auth_member_ids())
     or lt.organization_id in (select auth_org_ids())
  group by lt.member_id, lt.organization_id;

grant select on member_points_balance to authenticated;

-- 2. Gym revenue summary (true lifetime totals). Staff-only: scoped to the caller's
--    orgs. 'open' is the only unpaid invoice_status ('past_due' is a SUBSCRIPTION
--    status — see 0033); 'void'/'uncollectible' are excluded from outstanding.
create or replace view gym_revenue_summary
with (security_invoker = false) as
  select i.organization_id,
         coalesce(sum(i.amount_cents) filter (where i.status = 'paid'), 0)::bigint as paid_cents,
         coalesce(sum(i.amount_cents) filter (where i.status = 'open'), 0)::bigint as outstanding_cents
  from invoices i
  where i.organization_id in (select auth_org_ids())
  group by i.organization_id;

grant select on gym_revenue_summary to authenticated;

-- End of 0059_aggregate_views.sql
