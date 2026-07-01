-- ============================================================================
-- LUDUZO — Phase 8: Platform & Admin (SaaS essentials). Builds on 0001.
--
-- Governed by: CLAUDE.md §1.5.1 layer 1 · A5 (RLS) · A12 · §3.4 (honest scope).
--
-- Adds:
--   organizations +cols  — white-label (brand_color/accent/logo), plan_tier,
--                          default_currency, locale (i18n/multi-currency).
--   api_keys             — per-org API keys (prefix + token; scaffold).
--   webhooks             — per-org webhook registrations (delivery NOT implemented).
--   consent_records      — GDPR/consent log per member.
--
-- STATUS: applied + verified live by the agent on run. A12: all objects guarded.
-- ============================================================================

alter table organizations add column if not exists brand_color text;
alter table organizations add column if not exists accent_color text;
alter table organizations add column if not exists logo_url text;
alter table organizations add column if not exists plan_tier text not null default 'free';
alter table organizations add column if not exists default_currency text not null default 'USD';
alter table organizations add column if not exists locale text not null default 'en';

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  token text not null,            -- scaffold: opaque token (see honest note in build report)
  last_used_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_api_keys_org on api_keys(organization_id);

create table if not exists webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  url text not null,
  event_types text[] not null default '{}',
  secret text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_webhooks_org on webhooks(organization_id);

create table if not exists consent_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  consent_type text not null,     -- marketing | data_processing | photos | ...
  granted boolean not null default true,
  recorded_at timestamptz not null default now()
);
create index if not exists idx_consent_org on consent_records(organization_id);
create index if not exists idx_consent_member on consent_records(member_id);

-- ---------- RLS (A5) ----------
alter table api_keys enable row level security;
alter table webhooks enable row level security;
alter table consent_records enable row level security;

-- API keys + webhooks: owner/admin only.
drop policy if exists api_keys_select on api_keys;
create policy api_keys_select on api_keys for select using (auth_has_org_role(organization_id, array['owner','admin']::app_role[]));
drop policy if exists api_keys_write on api_keys;
create policy api_keys_write on api_keys for all
  using (auth_has_org_role(organization_id, array['owner','admin']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin']::app_role[]));

drop policy if exists webhooks_select on webhooks;
create policy webhooks_select on webhooks for select using (auth_has_org_role(organization_id, array['owner','admin']::app_role[]));
drop policy if exists webhooks_write on webhooks;
create policy webhooks_write on webhooks for all
  using (auth_has_org_role(organization_id, array['owner','admin']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin']::app_role[]));

-- Consent: staff read/write; a member may read their own.
drop policy if exists consent_select on consent_records;
create policy consent_select on consent_records for select
  using (organization_id in (select auth_org_ids()) or member_id in (select auth_member_ids()));
drop policy if exists consent_write on consent_records;
create policy consent_write on consent_records for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]));

-- End of 0030_platform_admin.sql
