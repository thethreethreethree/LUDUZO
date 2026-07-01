-- ============================================================================
-- LUDUZO — Loyalty verification probe: RLS + balance.
-- NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0015, 0016 are applied. Expect ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','lo-o-a@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','lo-m-a@luduzo.test','{"full_name":"Member A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'authenticated','authenticated','lo-o-b@luduzo.test','{"full_name":"Owner B"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('LO Gym A','lo-gym-a'); perform set_config('lo.orgA', v::text, true);
exception when others then perform set_config('lo.orgA','', true); end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('LO Gym B','lo-gym-b'); perform set_config('lo.orgB', v::text, true);
exception when others then perform set_config('lo.orgB','', true); end $$;
reset role;

-- seed: a member linked to the customer auth user (aaaaaaa3), points 100 - 30 = 70
do $$
declare oa uuid := nullif(current_setting('lo.orgA', true), '')::uuid;
        ob uuid := nullif(current_setting('lo.orgB', true), '')::uuid; ma uuid; mb uuid;
begin
  insert into members (organization_id, first_name, last_name, profile_id) values (oa,'Loy','MemberA','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa') returning id into ma;
  insert into members (organization_id, first_name, last_name) values (ob,'Loy','MemberB') returning id into mb;
  insert into loyalty_transactions (organization_id, member_id, points, reason) values
    (oa, ma, 100, 'signup'), (oa, ma, -30, 'redeem'), (ob, mb, 50, 'signup');
  perform set_config('lo.ma', ma::text, true);
  perform set_config('lo.seed','PASS',true);
exception when others then perform set_config('lo.seed','ERROR: '||sqlerrm, true); end $$;

-- owner A: isolation + balance 70 + can write
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare n int; bal int; oa uuid := nullif(current_setting('lo.orgA', true), '')::uuid; ma uuid := nullif(current_setting('lo.ma', true), '')::uuid;
begin
  select count(*) into n from loyalty_transactions;
  perform set_config('lo.iso_a', case when n=2 and not exists(select 1 from loyalty_transactions where organization_id<>oa) then 'PASS' else format('FAIL: sees %s',n) end, true);
  select coalesce(sum(points),0) into bal from loyalty_transactions where member_id=ma;
  perform set_config('lo.balance', case when bal=70 then 'PASS' else format('FAIL: balance=%s',bal) end, true);
  insert into loyalty_transactions (organization_id, member_id, points, reason) values (oa, ma, 10, 'bonus');
  get diagnostics n = row_count;
  perform set_config('lo.write_staff', case when n=1 then 'PASS' else format('FAIL: %s rows',n) end, true);
exception when others then
  perform set_config('lo.iso_a','ERROR: '||sqlerrm,true);
  perform set_config('lo.balance','ERROR: '||sqlerrm,true);
  perform set_config('lo.write_staff','ERROR: '||sqlerrm,true);
end $$;
reset role;

-- customer (aaaaaaa3, linked member): sees own loyalty rows, cannot write
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare n int;
begin
  select count(*) into n from loyalty_transactions;
  perform set_config('lo.member_sees_own', case when n >= 2 then 'PASS' else format('FAIL: member sees %s',n) end, true);
exception when others then perform set_config('lo.member_sees_own','ERROR: '||sqlerrm,true); end $$;
do $$ declare oa uuid := nullif(current_setting('lo.orgA', true), '')::uuid; ma uuid := nullif(current_setting('lo.ma', true), '')::uuid;
begin
  insert into loyalty_transactions (organization_id, member_id, points) values (oa, ma, 999);
  perform set_config('lo.member_no_write','FAIL: member wrote points',true);
exception when insufficient_privilege then perform set_config('lo.member_no_write','PASS',true);
when others then perform set_config('lo.member_no_write','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'iso_a'          ,'owner A sees only org A loyalty rows'),
    (2,'balance'        ,'balance sums to 70 (100 - 30)'),
    (3,'write_staff'    ,'staff can award points'),
    (4,'member_sees_own','linked member sees own points'),
    (5,'member_no_write','member CANNOT write points')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('lo.'||test, true), ''), '(not run)') as result
  from results
)
select ord, test, result, descr from evaluated
union all
select 999, 'OVERALL',
  case when (select bool_and(result like 'PASS%') from evaluated) then 'ALL PASS'
       else 'SEE FAIL / ERROR ROWS ABOVE' end,
  'aggregate verdict'
order by ord;

rollback;
-- End of 0016_loyalty_rls_verify.sql
