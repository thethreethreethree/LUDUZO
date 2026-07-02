-- ============================================================================
-- LUDUZO — Rewards catalog + point redemption (§9).
--
-- Governed by: §3.1 (redemption + the spend are recorded) · §3.2 (RLS) · §1.5.1 L2
--   · A5 · A12. Staff define rewards; a member redeems points for one via a
-- SECURITY DEFINER RPC that checks the balance and atomically records the
-- redemption + a negative loyalty_transaction (the point spend).
--
-- ⚠ STATUS: authored while the direct-Postgres host was unreachable — UNAPPLIED.
-- Apply via the Supabase SQL editor. The /more rewards list + redeem degrade
-- gracefully until then (empty catalog; redeem maps missing-fn to a friendly note).
-- ============================================================================

create table if not exists rewards (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  cost_points     integer not null check (cost_points > 0),
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists idx_rewards_org on rewards(organization_id);

create table if not exists reward_redemptions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  reward_id       uuid not null references rewards(id) on delete set null,
  reward_name     text,
  points_spent    integer not null,
  status          text not null default 'pending',
  created_at      timestamptz not null default now()
);
create index if not exists idx_redemptions_member on reward_redemptions(member_id, created_at desc);

alter table rewards enable row level security;
alter table reward_redemptions enable row level security;

drop policy if exists rewards_staff on rewards;
create policy rewards_staff on rewards for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]));
drop policy if exists rewards_member_read on rewards;
create policy rewards_member_read on rewards for select
  using (active and organization_id in (select auth_member_org_ids()));

drop policy if exists redemptions_staff on reward_redemptions;
create policy redemptions_staff on reward_redemptions for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]));
drop policy if exists redemptions_member_read on reward_redemptions;
create policy redemptions_member_read on reward_redemptions for select
  using (member_id in (select auth_member_ids()));

-- Atomic redeem: verify balance, record the redemption + the negative loyalty txn.
create or replace function redeem_reward(p_reward_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_member uuid;
  v_org    uuid;
  v_cost   integer;
  v_name   text;
  v_active boolean;
  v_balance integer;
begin
  if v_uid is null then raise exception 'redeem_reward: not authenticated'; end if;

  select organization_id, cost_points, name, active into v_org, v_cost, v_name, v_active
  from rewards where id = p_reward_id for update;
  if v_org is null then raise exception 'redeem_reward: reward not found'; end if;
  if not v_active then raise exception 'redeem_reward: reward is not available'; end if;

  select id into v_member from members where profile_id = v_uid and organization_id = v_org limit 1;
  if v_member is null then raise exception 'redeem_reward: no membership in this gym'; end if;

  select coalesce(sum(points), 0) into v_balance from loyalty_transactions where member_id = v_member;
  if v_balance < v_cost then raise exception 'redeem_reward: not enough points'; end if;

  insert into reward_redemptions (organization_id, member_id, reward_id, reward_name, points_spent, status)
  values (v_org, v_member, p_reward_id, v_name, v_cost, 'pending');
  insert into loyalty_transactions (organization_id, member_id, points, reason)
  values (v_org, v_member, -v_cost, 'Redeemed: ' || v_name);

  return 'ok';
end $$;

grant execute on function redeem_reward(uuid) to authenticated;

-- End of 0055_rewards.sql
