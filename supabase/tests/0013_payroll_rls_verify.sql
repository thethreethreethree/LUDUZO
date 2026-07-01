-- ============================================================================
-- LUDUZO — Payroll verification probe: commissions RLS (management vs own).
-- NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0013 are applied. Expect ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','pay-o-a@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','pay-t-a@luduzo.test','{"full_name":"Trainer A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','pay-f-a@luduzo.test','{"full_name":"Front A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'authenticated','authenticated','pay-o-b@luduzo.test','{"full_name":"Owner B"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('PAY Gym A','pay-gym-a'); perform set_config('pay.orgA', v::text, true);
exception when others then perform set_config('pay.orgA','', true); end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('PAY Gym B','pay-gym-b'); perform set_config('pay.orgB', v::text, true);
exception when others then perform set_config('pay.orgB','', true); end $$;
reset role;

do $$
declare oa uuid := nullif(current_setting('pay.orgA', true), '')::uuid;
        ob uuid := nullif(current_setting('pay.orgB', true), '')::uuid;
begin
  insert into organization_members (organization_id, user_id, role) values
    (oa, 'aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'trainer'),
    (oa, 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'front_desk');
  insert into commissions (organization_id, staff_user_id, amount_cents, reason) values
    (oa, 'aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 5000, 'PT session'),
    (oa, 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2000, 'Retail'),
    (ob, 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1000, 'B');
  perform set_config('pay.seed','PASS',true);
exception when others then perform set_config('pay.seed','ERROR: '||sqlerrm, true); end $$;

-- owner A (management): sees all org A commissions, none from org B; can create; cross blocked
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare n int; oa uuid := nullif(current_setting('pay.orgA', true), '')::uuid;
begin
  select count(*) into n from commissions;
  perform set_config('pay.mgmt_sees_all', case when n=2 and not exists(select 1 from commissions where organization_id<>oa) then 'PASS' else format('FAIL: owner sees %s',n) end, true);
  insert into commissions (organization_id, staff_user_id, amount_cents) values (oa, 'aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 100);
  get diagnostics n = row_count;
  perform set_config('pay.write_mgmt', case when n=1 then 'PASS' else format('FAIL: %s rows',n) end, true);
exception when others then
  perform set_config('pay.mgmt_sees_all','ERROR: '||sqlerrm,true);
  perform set_config('pay.write_mgmt','ERROR: '||sqlerrm,true);
end $$;
do $$ declare ob uuid := nullif(current_setting('pay.orgB', true), '')::uuid;
begin
  insert into commissions (organization_id, staff_user_id, amount_cents) values (ob, 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1);
  perform set_config('pay.write_cross','FAIL: owner A wrote into org B',true);
exception when insufficient_privilege then perform set_config('pay.write_cross','PASS',true);
when others then perform set_config('pay.write_cross','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- trainer (non-management staff): sees ONLY own commissions, cannot write
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare n int;
begin
  select count(*) into n from commissions;
  perform set_config('pay.staff_sees_own',
    case when n >= 1 and not exists (select 1 from commissions where staff_user_id <> 'aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)
         then 'PASS' else format('FAIL: trainer sees %s (incl others)', n) end, true);
exception when others then perform set_config('pay.staff_sees_own','ERROR: '||sqlerrm,true); end $$;
do $$ declare oa uuid := nullif(current_setting('pay.orgA', true), '')::uuid;
begin
  insert into commissions (organization_id, staff_user_id, amount_cents) values (oa, 'aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1);
  perform set_config('pay.write_staff','FAIL: trainer wrote a commission',true);
exception when insufficient_privilege then perform set_config('pay.write_staff','PASS',true);
when others then perform set_config('pay.write_staff','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'mgmt_sees_all'  ,'management sees all org commissions'),
    (2,'staff_sees_own' ,'non-mgmt staff sees ONLY own commissions'),
    (3,'write_mgmt'     ,'management can create a commission'),
    (4,'write_staff'    ,'non-mgmt staff CANNOT create a commission'),
    (5,'write_cross'    ,'owner A CANNOT write into org B')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('pay.'||test, true), ''), '(not run)') as result
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
-- End of 0013_payroll_rls_verify.sql
