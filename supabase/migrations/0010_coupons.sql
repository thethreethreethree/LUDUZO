-- ============================================================================
-- LUDUZO — Phase 3 (remainder): Discounts / coupons. Builds on 0001.
-- Governed by: CLAUDE.md §1.5.1 layer 1 · §1.7 · A12 (safe-to-re-run) · A5 (RLS).
-- FLAGGED: redemption enforcement (applying a coupon to an invoice/subscription)
--   is app/billing logic, deferred with Stripe. This stores the catalog only.
-- STATUS: UNTESTED until run. A12: all objects guarded.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'discount_type') then
    create type discount_type as enum ('percent','amount');
  end if;
end$$;

create table if not exists coupons (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  code             text not null,
  description      text,
  discount_type    discount_type not null default 'percent',
  discount_value   integer not null default 0 check (discount_value >= 0),  -- percent (0-100) or minor units
  currency         text not null default 'usd',
  active           boolean not null default true,
  expires_at       timestamptz,
  max_redemptions  integer,
  redemptions      integer not null default 0 check (redemptions >= 0),
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, code)
);
create index if not exists idx_coupons_org on coupons(organization_id);
drop trigger if exists trg_coupons_updated on coupons;
create trigger trg_coupons_updated before update on coupons
  for each row execute function set_updated_at();

alter table coupons enable row level security;
drop policy if exists coupons_select on coupons;
create policy coupons_select on coupons for select
  using (organization_id in (select auth_org_ids()));
drop policy if exists coupons_write on coupons;
create policy coupons_write on coupons for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

-- End of 0010_coupons.sql
