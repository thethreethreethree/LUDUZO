-- ============================================================================
-- LUDUZO — Phase 5+ (engagement): loyalty points ledger.
-- Builds on 0002 (members) + 0015 (auth_member_ids for own-read).
--
-- An append-only-by-convention ledger: positive points = earned, negative =
-- redeemed. A member's balance = sum(points). Read = tenant staff OR the member
-- themselves; write = staff.
--
-- Governed by: CLAUDE.md §1.5.1 L1 · §3.1 (ledger spirit) · A5 · A12. UNTESTED until run.
-- ============================================================================

create table if not exists loyalty_transactions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  points          integer not null,
  reason          text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_loyalty_member on loyalty_transactions(member_id);
create index if not exists idx_loyalty_org on loyalty_transactions(organization_id);

alter table loyalty_transactions enable row level security;

drop policy if exists loyalty_select on loyalty_transactions;
create policy loyalty_select on loyalty_transactions for select using (
  organization_id in (select auth_org_ids())
  or member_id in (select auth_member_ids())
);

drop policy if exists loyalty_write on loyalty_transactions;
create policy loyalty_write on loyalty_transactions for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]));

-- End of 0016_loyalty.sql
