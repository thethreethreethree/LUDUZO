-- ============================================================================
-- LUDUZO — Phase 3 (core) verification probe: plans / subscriptions / invoices
-- RLS + subscription events. NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0005 are applied. Expect all PASS / OVERALL ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','b-o-a@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','b-f-a@luduzo.test','{"full_name":"Front A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'authenticated','authenticated','b-o-b@luduzo.test','{"full_name":"Owner B"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('BILL Gym A','bill-gym-a'); perform set_config('bill.orgA', v::text, true);
exception when others then perform set_config('bill.orgA','', true); end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('BILL Gym B','bill-gym-b'); perform set_config('bill.orgB', v::text, true);
exception when others then perform set_config('bill.orgB','', true); end $$;
reset role;

-- staff + seed plans / members / subscriptions (privileged)
do $$
declare oa uuid := nullif(current_setting('bill.orgA', true), '')::uuid;
        ob uuid := nullif(current_setting('bill.orgB', true), '')::uuid;
        pa uuid; ma uuid; mb uuid;
begin
  insert into organization_members (organization_id, user_id, role) values
    (oa, 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'front_desk');
  insert into plans (organization_id, name, price_cents, interval) values (oa,'Basic',2500,'month') returning id into pa;
  insert into plans (organization_id, name, price_cents, interval) values (ob,'B Plan',3000,'month');
  insert into members (organization_id, first_name, last_name) values (oa,'Bill','MemberA') returning id into ma;
  insert into members (organization_id, first_name, last_name) values (ob,'Bill','MemberB') returning id into mb;
  insert into subscriptions (organization_id, member_id, plan_id, status) values (oa, ma, pa, 'active');
  insert into subscriptions (organization_id, member_id, status) values (ob, mb, 'active');
  perform set_config('bill.planA', pa::text, true);
  perform set_config('bill.memberA', ma::text, true);
  perform set_config('bill.seed','PASS',true);
exception when others then perform set_config('bill.seed','ERROR: '||sqlerrm, true); end $$;

-- owner A: isolation + cross-tenant plan write blocked
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare n int; oa uuid := nullif(current_setting('bill.orgA', true), '')::uuid;
begin
  select count(*) into n from plans;
  perform set_config('bill.iso_plans_a', case when n=1 and not exists(select 1 from plans where organization_id<>oa) then 'PASS' else format('FAIL: sees %s plans',n) end, true);
  select count(*) into n from subscriptions;
  perform set_config('bill.iso_subs_a', case when n=1 and not exists(select 1 from subscriptions where organization_id<>oa) then 'PASS' else format('FAIL: sees %s subs',n) end, true);
  insert into plans (organization_id, name, price_cents) values (oa, 'Owner Plan', 1000);
  get diagnostics n = row_count;
  perform set_config('bill.write_plan_owner', case when n=1 then 'PASS' else format('FAIL: %s rows',n) end, true);
exception when others then
  perform set_config('bill.iso_plans_a','ERROR: '||sqlerrm,true);
  perform set_config('bill.iso_subs_a','ERROR: '||sqlerrm,true);
  perform set_config('bill.write_plan_owner','ERROR: '||sqlerrm,true);
end $$;
do $$ declare ob uuid := nullif(current_setting('bill.orgB', true), '')::uuid;
begin
  insert into plans (organization_id, name, price_cents) values (ob, 'Cross Plan', 100);
  perform set_config('bill.write_cross','FAIL: owner A wrote plan into org B',true);
exception when insufficient_privilege then perform set_config('bill.write_cross','PASS',true);
when others then perform set_config('bill.write_cross','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- front_desk: cannot write a plan (mgmt-only); can create a subscription (+ event)
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare oa uuid := nullif(current_setting('bill.orgA', true), '')::uuid;
begin
  insert into plans (organization_id, name, price_cents) values (oa, 'Front Plan', 500);
  perform set_config('bill.write_plan_front','FAIL: front_desk wrote a plan',true);
exception when insufficient_privilege then perform set_config('bill.write_plan_front','PASS',true);
when others then perform set_config('bill.write_plan_front','UNEXPECTED: '||sqlerrm,true); end $$;
do $$ declare oa uuid := nullif(current_setting('bill.orgA', true), '')::uuid;
            ma uuid := nullif(current_setting('bill.memberA', true), '')::uuid;
            pa uuid := nullif(current_setting('bill.planA', true), '')::uuid;
            sid uuid; n int;
begin
  insert into subscriptions (organization_id, member_id, plan_id, status) values (oa, ma, pa, 'active') returning id into sid;
  get diagnostics n = row_count;
  perform set_config('bill.write_sub_front', case when n=1 then 'PASS' else format('FAIL: %s rows',n) end, true);
  perform set_config('bill.evt_sub',
    case when exists(select 1 from events where subject_type='subscription' and subject_id=sid and event_type='subscription.created')
         then 'PASS' else 'FAIL: subscription.created not emitted' end, true);
exception when others then
  perform set_config('bill.write_sub_front','ERROR: '||sqlerrm,true);
  perform set_config('bill.evt_sub','ERROR: '||sqlerrm,true);
end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'iso_plans_a'      ,'owner A sees only org A plans'),
    (2,'iso_subs_a'       ,'owner A sees only org A subscriptions'),
    (3,'write_plan_owner' ,'owner can create a plan'),
    (4,'write_plan_front' ,'front_desk CANNOT create a plan (mgmt only)'),
    (5,'write_sub_front'  ,'front_desk can create a subscription'),
    (6,'evt_sub'          ,'subscription.created event emitted'),
    (7,'write_cross'      ,'owner A CANNOT write plan into org B')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('bill.'||test, true), ''), '(not run)') as result
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
-- End of 0005_billing_rls_verify.sql
