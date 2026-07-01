-- ============================================================================
-- LUDUZO — Phase 3 (remainder) verification probe: coupons RLS.
-- NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0010 are applied. Expect all PASS / OVERALL ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','co-o-a@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','co-f-a@luduzo.test','{"full_name":"Front A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'authenticated','authenticated','co-o-b@luduzo.test','{"full_name":"Owner B"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('CO Gym A','co-gym-a'); perform set_config('co.orgA', v::text, true);
exception when others then perform set_config('co.orgA','', true); end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('CO Gym B','co-gym-b'); perform set_config('co.orgB', v::text, true);
exception when others then perform set_config('co.orgB','', true); end $$;
reset role;

do $$
declare oa uuid := nullif(current_setting('co.orgA', true), '')::uuid;
        ob uuid := nullif(current_setting('co.orgB', true), '')::uuid;
begin
  insert into organization_members (organization_id, user_id, role) values
    (oa, 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'front_desk');
  insert into coupons (organization_id, code, discount_type, discount_value) values
    (oa,'WELCOME10','percent',10), (ob,'BWELCOME','percent',10);
  perform set_config('co.seed','PASS',true);
exception when others then perform set_config('co.seed','ERROR: '||sqlerrm, true); end $$;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare n int; oa uuid := nullif(current_setting('co.orgA', true), '')::uuid;
begin
  select count(*) into n from coupons;
  perform set_config('co.iso_a', case when n=1 and not exists(select 1 from coupons where organization_id<>oa) then 'PASS' else format('FAIL: sees %s',n) end, true);
  insert into coupons (organization_id, code, discount_type, discount_value) values (oa,'SUMMER','amount',500);
  get diagnostics n = row_count;
  perform set_config('co.write_owner', case when n=1 then 'PASS' else format('FAIL: %s rows',n) end, true);
exception when others then
  perform set_config('co.iso_a','ERROR: '||sqlerrm,true);
  perform set_config('co.write_owner','ERROR: '||sqlerrm,true);
end $$;
do $$ declare ob uuid := nullif(current_setting('co.orgB', true), '')::uuid;
begin
  insert into coupons (organization_id, code, discount_type, discount_value) values (ob,'CROSS','percent',1);
  perform set_config('co.write_cross','FAIL: owner A wrote into org B',true);
exception when insufficient_privilege then perform set_config('co.write_cross','PASS',true);
when others then perform set_config('co.write_cross','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare oa uuid := nullif(current_setting('co.orgA', true), '')::uuid;
begin
  insert into coupons (organization_id, code, discount_type, discount_value) values (oa,'FRONT','percent',1);
  perform set_config('co.write_front','FAIL: front_desk wrote a coupon',true);
exception when insufficient_privilege then perform set_config('co.write_front','PASS',true);
when others then perform set_config('co.write_front','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'iso_a'       ,'owner A sees only org A coupons'),
    (2,'write_owner' ,'owner can create a coupon'),
    (3,'write_front' ,'front_desk CANNOT create a coupon (mgmt only)'),
    (4,'write_cross' ,'owner A CANNOT write coupon into org B'),
    (5,'seed'        ,'fixtures seeded')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('co.'||test, true), ''), '(not run)') as result
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
-- End of 0010_coupons_rls_verify.sql
