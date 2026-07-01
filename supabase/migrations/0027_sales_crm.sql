-- ============================================================================
-- LUDUZO — Phase 4: Sales & CRM. Builds on 0001, 0002, 0005.
--
-- Governed by: CLAUDE.md §1.5.1 layer 1 · §3.1 (events) · A5 (RLS) · A12.
--
-- Adds:
--   leads       — CRM lead capture + sales pipeline (stage).
--   gift_cards  — prepaid balances (record-only; no card processing).
--   refunds     — recorded refunds against invoices (record-only).
--   suspend_overdue_members() — auto-suspension: freeze members with past_due invoices.
--
-- STATUS: applied + verified live by the agent on run. A12: all objects guarded.
-- ============================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'lead_stage') then
    create type lead_stage as enum ('new','contacted','toured','trial','won','lost');
  end if;
end $$;

-- ---------- leads ----------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  source text,
  stage lead_stage not null default 'new',
  owner_id uuid references profiles(id) on delete set null,
  notes text,
  converted_member_id uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_leads_org on leads(organization_id, stage);
drop trigger if exists trg_leads_updated on leads;
create trigger trg_leads_updated before update on leads for each row execute function set_updated_at();

create or replace function leads_emit_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
    values (new.organization_id, auth.uid(), 'lead.created', 'lead', new.id, jsonb_build_object('name', new.name, 'source', new.source));
  elsif tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
    values (new.organization_id, auth.uid(), 'lead.stage_changed', 'lead', new.id, jsonb_build_object('from', old.stage, 'to', new.stage));
  end if;
  return new;
end $$;
drop trigger if exists trg_leads_emit_insert on leads;
create trigger trg_leads_emit_insert after insert on leads for each row execute function leads_emit_events();
drop trigger if exists trg_leads_emit_update on leads;
create trigger trg_leads_emit_update after update on leads for each row execute function leads_emit_events();

-- ---------- gift_cards ----------
create table if not exists gift_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  initial_cents integer not null default 0 check (initial_cents >= 0),
  balance_cents integer not null default 0 check (balance_cents >= 0),
  issued_to_member uuid references members(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);
create index if not exists idx_gift_cards_org on gift_cards(organization_id);

-- ---------- refunds ----------
create table if not exists refunds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  member_id uuid references members(id) on delete set null,
  amount_cents integer not null check (amount_cents >= 0),
  reason text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_refunds_org on refunds(organization_id);

-- ---------- auto-suspension (freeze members with past_due invoices) ----------
create or replace function suspend_overdue_members(p_org uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not auth_has_org_role(p_org, array['owner','admin','manager']::app_role[]) then
    raise exception 'suspend_overdue_members: not authorized' using errcode = 'insufficient_privilege';
  end if;
  with overdue as (
    select distinct member_id from invoices
    where organization_id = p_org and status = 'past_due' and member_id is not null
  )
  update members m set status = 'frozen'
  from overdue o
  where m.id = o.member_id and m.organization_id = p_org and m.status = 'active';
  get diagnostics v_count = row_count;
  return v_count;
end $$;
grant execute on function suspend_overdue_members(uuid) to authenticated;

-- ---------- RLS (A5) ----------
alter table leads enable row level security;
alter table gift_cards enable row level security;
alter table refunds enable row level security;

drop policy if exists leads_select on leads;
create policy leads_select on leads for select using (organization_id in (select auth_org_ids()));
drop policy if exists leads_write on leads;
create policy leads_write on leads for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]));

drop policy if exists gift_cards_select on gift_cards;
create policy gift_cards_select on gift_cards for select using (organization_id in (select auth_org_ids()));
drop policy if exists gift_cards_write on gift_cards;
create policy gift_cards_write on gift_cards for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]));

drop policy if exists refunds_select on refunds;
create policy refunds_select on refunds for select using (organization_id in (select auth_org_ids()));
drop policy if exists refunds_write on refunds;
create policy refunds_write on refunds for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager']::app_role[]));

-- End of 0027_sales_crm.sql
