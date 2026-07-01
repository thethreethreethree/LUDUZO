-- ============================================================================
-- LUDUZO — Phase 5+ (communication/CRM): per-member communication log.
-- Builds on 0002 (members). Governed by: §1.5.1 L1 · §1.7 · A5 · A12. UNTESTED until run.
-- ============================================================================

create table if not exists member_communications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  channel         text not null default 'note',   -- note / email / sms / call
  subject         text,
  body            text,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_member_comms_member on member_communications(member_id, created_at desc);
create index if not exists idx_member_comms_org on member_communications(organization_id);

alter table member_communications enable row level security;
drop policy if exists member_comms_select on member_communications;
create policy member_comms_select on member_communications for select
  using (organization_id in (select auth_org_ids()));
drop policy if exists member_comms_write on member_communications;
create policy member_comms_write on member_communications for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]));

-- End of 0017_communications.sql
