-- ============================================================================
-- LUDUZO — Phase 6: Inventory & Equipment ops. Builds on 0001, 0008.
--
-- Governed by: CLAUDE.md §1.5.1 layer 1 · A5 (RLS) · A12.
--
-- Adds:
--   suppliers              — vendor directory.
--   equipment_maintenance  — maintenance schedule + downtime logs.
--   locker_rentals         — locker rental management.
--   products.reorder_level — stock-alert threshold (alerts derived at query time).
--   equipment.asset_tag / supplier_id / purchased_on — asset tracking.
--
-- STATUS: applied + verified live by the agent on run. A12: all objects guarded.
-- ============================================================================

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_suppliers_org on suppliers(organization_id);

create table if not exists equipment_maintenance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  equipment_id uuid references equipment(id) on delete cascade,
  kind text not null default 'service', -- service | repair | inspection
  scheduled_for date,
  completed_at date,
  down boolean not null default false,  -- currently out of service?
  cost_cents integer not null default 0 check (cost_cents >= 0),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_equipment_maintenance_org on equipment_maintenance(organization_id);
create index if not exists idx_equipment_maintenance_eq on equipment_maintenance(equipment_id);

create table if not exists locker_rentals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  locker_label text not null,
  member_id uuid references members(id) on delete set null,
  monthly_fee_cents integer not null default 0 check (monthly_fee_cents >= 0),
  starts_on date,
  ends_on date,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
create index if not exists idx_locker_rentals_org on locker_rentals(organization_id);

alter table products add column if not exists reorder_level integer not null default 0;
alter table equipment add column if not exists asset_tag text;
alter table equipment add column if not exists supplier_id uuid references suppliers(id) on delete set null;
alter table equipment add column if not exists purchased_on date;

-- ---------- RLS (A5): tenant read; mgmt write ----------
do $$
declare t text;
begin
  foreach t in array array['suppliers','equipment_maintenance','locker_rentals'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t||'_select', t);
    execute format('create policy %I on %I for select using (organization_id in (select auth_org_ids()))', t||'_select', t);
    execute format('drop policy if exists %I on %I', t||'_write', t);
    execute format('create policy %I on %I for all using (auth_has_org_role(organization_id, array[''owner'',''admin'',''manager'']::app_role[])) with check (auth_has_org_role(organization_id, array[''owner'',''admin'',''manager'']::app_role[]))', t||'_write', t);
  end loop;
end $$;

-- End of 0029_inventory_ops.sql
