-- ============================================================================
-- LUDUZO — Phase 2 (secondary): member groups (family/corporate), guest passes,
-- referrals. Builds on 0001 + 0002.
--
-- Governed by: CLAUDE.md §1.5.1 layer 1 · §1.7 · §3.1 · A12 (safe-to-re-run) ·
--   A5 (RLS ripple). RLS shape is consistent with members (tenant read, staff write).
--
-- FLAGGED PRODUCT DECISIONS (defaults chosen; override later — A20/§4):
--   * Referral reward semantics (what a "rewarded" referral grants) are NOT
--     modeled here — only the lifecycle status is. Deferred until billing exists.
--   * Guest-pass code generation/redemption rules are app-level; the column exists
--     but no uniqueness/format is enforced yet.
--
-- STATUS: UNTESTED until run. A12: all objects guarded.
-- ============================================================================

-- ---------- Enums ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'group_type') then
    create type group_type as enum ('family','corporate','group');
  end if;
  if not exists (select 1 from pg_type where typname = 'guest_pass_status') then
    create type guest_pass_status as enum ('issued','redeemed','expired','revoked');
  end if;
  if not exists (select 1 from pg_type where typname = 'referral_status') then
    create type referral_status as enum ('pending','joined','rewarded','expired');
  end if;
end$$;

-- ---------- member_groups (family / corporate / general account) ----------
create table if not exists member_groups (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  name              text not null,
  group_type        group_type not null default 'family',
  primary_member_id uuid references members(id) on delete set null,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_member_groups_org on member_groups(organization_id);
drop trigger if exists trg_member_groups_updated on member_groups;
create trigger trg_member_groups_updated before update on member_groups
  for each row execute function set_updated_at();

-- ---------- member_group_links (members <-> group) ----------
create table if not exists member_group_links (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  group_id        uuid not null references member_groups(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  relationship    text,                          -- e.g. 'parent','child','employee'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (group_id, member_id)
);
create index if not exists idx_mgl_org    on member_group_links(organization_id);
create index if not exists idx_mgl_group  on member_group_links(group_id);
create index if not exists idx_mgl_member on member_group_links(member_id);
drop trigger if exists trg_mgl_updated on member_group_links;
create trigger trg_mgl_updated before update on member_group_links
  for each row execute function set_updated_at();

-- ---------- guest_passes ----------
create table if not exists guest_passes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  host_member_id  uuid references members(id) on delete set null,
  guest_name      text not null,
  guest_email     text,
  code            text,                          -- app-generated; no format enforced yet
  status          guest_pass_status not null default 'issued',
  issued_at       timestamptz not null default now(),
  expires_at      timestamptz,
  redeemed_at     timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_guest_passes_org        on guest_passes(organization_id);
create index if not exists idx_guest_passes_org_status on guest_passes(organization_id, status);
drop trigger if exists trg_guest_passes_updated on guest_passes;
create trigger trg_guest_passes_updated before update on guest_passes
  for each row execute function set_updated_at();

-- ---------- referrals ----------
create table if not exists referrals (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organizations(id) on delete cascade,
  referrer_member_id uuid references members(id) on delete set null,
  referred_name      text,
  referred_email     text,
  referred_member_id uuid references members(id) on delete set null,  -- set when they join
  status             referral_status not null default 'pending',
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_referrals_org          on referrals(organization_id);
create index if not exists idx_referrals_org_status   on referrals(organization_id, status);
create index if not exists idx_referrals_referrer     on referrals(referrer_member_id);
drop trigger if exists trg_referrals_updated on referrals;
create trigger trg_referrals_updated before update on referrals
  for each row execute function set_updated_at();

-- ---------- RLS (tenant read; staff write) ----------
do $$
declare t text;
begin
  foreach t in array array['member_groups','member_group_links','guest_passes','referrals']
  loop
    execute format('alter table %I enable row level security', t);

    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format(
      'create policy %I on %I for select using (organization_id in (select auth_org_ids()))',
      t || '_select', t);

    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format(
      'create policy %I on %I for all '
      || 'using (auth_has_org_role(organization_id, array[''owner'',''admin'',''manager'',''front_desk'']::app_role[])) '
      || 'with check (auth_has_org_role(organization_id, array[''owner'',''admin'',''manager'',''front_desk'']::app_role[]))',
      t || '_write', t);
  end loop;
end$$;

-- End of 0003_relationships_guests_referrals.sql
