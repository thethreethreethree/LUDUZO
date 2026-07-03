-- ============================================================================
-- LUDUZO — Fix redeem_reward concurrency (audit Finding 1).
--
-- Governed by: §1.5.1 L2 (correctness under concurrency) · §3.1 (ledger integrity)
--   · A12. The 0055 version locked the REWARD row, but the balance constraint is
-- per-MEMBER, so two concurrent redeems of DIFFERENT rewards by the same member
-- both passed the balance check and overspent (negative balance). Fix: also lock
-- the MEMBER row (fixed order reward→member) so a member's redeems serialize and
-- the balance check is accurate. Create-or-replace; safe to re-run.
--
-- ⚠ STATUS: authored while the direct-Postgres host was unreachable — UNAPPLIED.
-- Apply via the Supabase SQL editor. Until applied, 0055's version stays live
-- (correct for sequential redeems; the race is the only gap).
-- ============================================================================

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

  -- Lock the member row so concurrent redeems by this member serialize (Finding 1).
  select id into v_member from members
  where profile_id = v_uid and organization_id = v_org
  limit 1 for update;
  if v_member is null then raise exception 'redeem_reward: no membership in this gym'; end if;

  select coalesce(sum(points), 0) into v_balance from loyalty_transactions where member_id = v_member;
  if v_balance < v_cost then raise exception 'redeem_reward: not enough points'; end if;

  insert into reward_redemptions (organization_id, member_id, reward_id, reward_name, points_spent, status)
  values (v_org, v_member, p_reward_id, v_name, v_cost, 'pending');
  insert into loyalty_transactions (organization_id, member_id, points, reason)
  values (v_org, v_member, -v_cost, 'Redeemed: ' || v_name);

  return 'ok';
end $$;

-- Re-assert the execute grant. CREATE OR REPLACE preserves the existing ACL from
-- 0055, so this is a no-op on the already-applied DB — but it keeps 0058
-- self-contained and replay-safe on a fresh/hot-fixed database (A12).
grant execute on function redeem_reward(uuid) to authenticated;

-- End of 0058_redeem_reward_member_lock.sql
