-- ============================================================================
-- LUDUZO — Phase 5+ : Inventory (retail products) & equipment. Builds on 0001.
--
-- Governed by: CLAUDE.md §1.5.1 layer 1 · §1.7 · A12 (safe-to-re-run) · A5 (RLS).
-- STATUS: UNTESTED until run. A12: all objects guarded.
-- ============================================================================

-- ---------- products (retail / POS items) ----------
create table if not exists products (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  sku             text,
  price_cents     integer not null default 0 check (price_cents >= 0),
  currency        text not null default 'usd',
  stock_quantity  integer not null default 0,
  active          boolean not null default true,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_products_org on products(organization_id);
create unique index if not exists uq_products_org_sku
  on products(organization_id, sku) where sku is not null;
drop trigger if exists trg_products_updated on products;
create trigger trg_products_updated before update on products
  for each row execute function set_updated_at();

-- ---------- equipment ----------
create table if not exists equipment (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  location_id     uuid references locations(id) on delete set null,
  status          text not null default 'operational',  -- operational/maintenance/retired
  purchased_at    date,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_equipment_org on equipment(organization_id);
drop trigger if exists trg_equipment_updated on equipment;
create trigger trg_equipment_updated before update on equipment
  for each row execute function set_updated_at();

-- ---------- RLS (tenant read; management write) ----------
do $$
declare t text;
begin
  foreach t in array array['products','equipment']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('create policy %I on %I for select using (organization_id in (select auth_org_ids()))', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format(
      'create policy %I on %I for all '
      || 'using (auth_has_org_role(organization_id, array[''owner'',''admin'',''manager'']::app_role[])) '
      || 'with check (auth_has_org_role(organization_id, array[''owner'',''admin'',''manager'']::app_role[]))',
      t || '_write', t);
  end loop;
end$$;

-- End of 0008_inventory.sql
