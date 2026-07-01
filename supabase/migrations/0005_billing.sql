-- ============================================================================
-- LUDUZO — Phase 3 (core): Membership plans, subscriptions, invoices.
-- Builds on 0001 + 0002. Schema only — NO Stripe integration here.
--
-- Governed by: CLAUDE.md §1.5.1 layer 1 · §1.7 · §3.1 (billing lifecycle events) ·
--   A12 (safe-to-re-run) · A5 (RLS ripple).
--
-- FLAGGED — FOUNDER DECISIONS (not resolved here; defaults chosen):
--   * C3 two-layer billing (Stripe Connect) is DEFERRED (per DEVELOPMENT-PLAN).
--     `stripe_*` id columns are reserved but unused until the integration + your
--     keys/decision land. This migration does not call Stripe.
--   * Prices are stored as integer minor units (cents) + currency code.
--
-- STATUS: UNTESTED until run. A12: all objects guarded.
-- ============================================================================

-- ---------- Enums ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_interval') then
    create type plan_interval as enum ('day','week','month','year','one_time');
  end if;
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type subscription_status as enum
      ('trialing','active','past_due','paused','canceled','incomplete','expired');
  end if;
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type invoice_status as enum ('draft','open','paid','void','uncollectible');
  end if;
end$$;

-- ---------- plans (membership tiers) ----------
create table if not exists plans (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  price_cents     integer not null default 0 check (price_cents >= 0),
  currency        text not null default 'usd',
  interval        plan_interval not null default 'month',
  interval_count  integer not null default 1 check (interval_count >= 1),
  active          boolean not null default true,
  stripe_price_id text,                          -- reserved; unused until integration
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_plans_org on plans(organization_id);
drop trigger if exists trg_plans_updated on plans;
create trigger trg_plans_updated before update on plans
  for each row execute function set_updated_at();

-- ---------- subscriptions (member <-> plan) ----------
create table if not exists subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations(id) on delete cascade,
  member_id              uuid not null references members(id) on delete cascade,
  plan_id                uuid references plans(id) on delete set null,
  status                 subscription_status not null default 'active',
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at              timestamptz,
  canceled_at            timestamptz,
  stripe_subscription_id text,                   -- reserved; unused until integration
  metadata               jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists idx_subs_org        on subscriptions(organization_id);
create index if not exists idx_subs_org_status on subscriptions(organization_id, status);
create index if not exists idx_subs_member     on subscriptions(member_id);
drop trigger if exists trg_subs_updated on subscriptions;
create trigger trg_subs_updated before update on subscriptions
  for each row execute function set_updated_at();

-- ---------- invoices ----------
create table if not exists invoices (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  member_id        uuid references members(id) on delete set null,
  subscription_id  uuid references subscriptions(id) on delete set null,
  amount_cents     integer not null default 0 check (amount_cents >= 0),
  currency         text not null default 'usd',
  status           invoice_status not null default 'draft',
  due_date         date,
  paid_at          timestamptz,
  stripe_invoice_id text,                        -- reserved; unused until integration
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_invoices_org        on invoices(organization_id);
create index if not exists idx_invoices_org_status on invoices(organization_id, status);
create index if not exists idx_invoices_member     on invoices(member_id);
drop trigger if exists trg_invoices_updated on invoices;
create trigger trg_invoices_updated before update on invoices
  for each row execute function set_updated_at();

-- ---------- Append-only billing lifecycle events (§3.1) ----------
create or replace function subscriptions_emit_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
    values (new.organization_id, auth.uid(), 'subscription.created', 'subscription', new.id,
            jsonb_build_object('member_id', new.member_id, 'plan_id', new.plan_id, 'status', new.status));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
    values (new.organization_id, auth.uid(), 'subscription.status_changed', 'subscription', new.id,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end$$;
drop trigger if exists trg_subs_emit_insert on subscriptions;
create trigger trg_subs_emit_insert after insert on subscriptions
  for each row execute function subscriptions_emit_events();
drop trigger if exists trg_subs_emit_update on subscriptions;
create trigger trg_subs_emit_update after update on subscriptions
  for each row execute function subscriptions_emit_events();

create or replace function invoices_emit_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'paid' then
    insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
    values (new.organization_id, auth.uid(), 'invoice.paid', 'invoice', new.id,
            jsonb_build_object('member_id', new.member_id, 'amount_cents', new.amount_cents));
  end if;
  return new;
end$$;
drop trigger if exists trg_invoices_emit on invoices;
create trigger trg_invoices_emit after update on invoices
  for each row execute function invoices_emit_events();

-- ---------- RLS ----------
-- plans: tenant read; management write (owner/admin/manager) — pricing is mgmt.
-- subscriptions/invoices: tenant read; staff write (incl front_desk for sign-ups).
do $$
begin
  -- plans
  execute 'alter table plans enable row level security';
  execute 'drop policy if exists plans_select on plans';
  execute 'create policy plans_select on plans for select using (organization_id in (select auth_org_ids()))';
  execute 'drop policy if exists plans_write on plans';
  execute 'create policy plans_write on plans for all '
       || 'using (auth_has_org_role(organization_id, array[''owner'',''admin'',''manager'']::app_role[])) '
       || 'with check (auth_has_org_role(organization_id, array[''owner'',''admin'',''manager'']::app_role[]))';
end$$;

do $$
declare t text;
begin
  foreach t in array array['subscriptions','invoices']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('create policy %I on %I for select using (organization_id in (select auth_org_ids()))', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format(
      'create policy %I on %I for all '
      || 'using (auth_has_org_role(organization_id, array[''owner'',''admin'',''manager'',''front_desk'']::app_role[])) '
      || 'with check (auth_has_org_role(organization_id, array[''owner'',''admin'',''manager'',''front_desk'']::app_role[]))',
      t || '_write', t);
  end loop;
end$$;

-- End of 0005_billing.sql
