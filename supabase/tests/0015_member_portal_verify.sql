-- ============================================================================
-- LUDUZO — Member portal verification probe: claim-by-email + own-record reads.
-- NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0005, 0014, 0015 are applied. Expect ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

-- owner (staff) + a CUSTOMER auth user whose email matches a member row.
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','po-owner@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','ccccccc9-cccc-cccc-cccc-cccccccccccc',
     'authenticated','authenticated','customer@luduzo.test','{"full_name":"Customer"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('PORT Gym A','port-gym-a'); perform set_config('port.orgA', v::text, true);
exception when others then perform set_config('port.orgA','', true); end $$;
reset role;

-- seed: a member with the customer's email (UNLINKED), a subscription + a measurement,
-- and a second member (someone else) the customer must NOT see.
do $$
declare oa uuid := nullif(current_setting('port.orgA', true), '')::uuid; ma uuid; mo uuid;
begin
  insert into members (organization_id, first_name, last_name, email) values (oa,'Cust','Omer','customer@luduzo.test') returning id into ma;
  insert into members (organization_id, first_name, last_name, email) values (oa,'Other','Person','other@luduzo.test') returning id into mo;
  insert into subscriptions (organization_id, member_id, status) values (oa, ma, 'active');
  insert into member_measurements (organization_id, member_id, weight_kg) values (oa, ma, 75.0);
  insert into invoices (organization_id, member_id, amount_cents, status) values (oa, ma, 5000, 'open');
  perform set_config('port.ma', ma::text, true);
  perform set_config('port.seed','PASS',true);
exception when others then perform set_config('port.seed','ERROR: '||sqlerrm, true); end $$;

-- customer: before claim, sees nothing (not staff, not linked)
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','ccccccc9-cccc-cccc-cccc-cccccccccccc','role','authenticated')::text, true);
do $$ declare n int;
begin
  select count(*) into n from members;
  perform set_config('port.before_claim', case when n=0 then 'PASS' else format('FAIL: sees %s before claim',n) end, true);
exception when others then perform set_config('port.before_claim','ERROR: '||sqlerrm,true); end $$;

-- customer: claim by email links the matching member row
do $$ declare linked int;
begin
  linked := link_my_member_records();
  perform set_config('port.claim', case when linked=1 then 'PASS' else format('FAIL: linked %s',linked) end, true);
exception when others then perform set_config('port.claim','ERROR: '||sqlerrm,true); end $$;

-- customer: after claim, sees ONLY own member + own subscription + own measurement, not others
do $$ declare n int;
begin
  select count(*) into n from members;
  perform set_config('port.sees_own_member', case when n=1 and not exists(select 1 from members where email='other@luduzo.test') then 'PASS' else format('FAIL: sees %s members',n) end, true);
  select count(*) into n from subscriptions;
  perform set_config('port.sees_own_sub', case when n=1 then 'PASS' else format('FAIL: sees %s subs',n) end, true);
  select count(*) into n from member_measurements;
  perform set_config('port.sees_own_measure', case when n=1 then 'PASS' else format('FAIL: sees %s measurements',n) end, true);
  select count(*) into n from invoices;
  perform set_config('port.sees_own_invoice', case when n=1 then 'PASS' else format('FAIL: sees %s invoices',n) end, true);
exception when others then
  perform set_config('port.sees_own_member','ERROR: '||sqlerrm,true);
  perform set_config('port.sees_own_sub','ERROR: '||sqlerrm,true);
  perform set_config('port.sees_own_measure','ERROR: '||sqlerrm,true);
  perform set_config('port.sees_own_invoice','ERROR: '||sqlerrm,true);
end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'before_claim'     ,'customer sees nothing before claiming'),
    (2,'claim'            ,'link_my_member_records() links 1 row by email'),
    (3,'sees_own_member'  ,'after claim: sees only own member (not others)'),
    (4,'sees_own_sub'     ,'after claim: sees own subscription'),
    (5,'sees_own_measure' ,'after claim: sees own measurements'),
    (6,'sees_own_invoice' ,'after claim: sees own invoices (A10)')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('port.'||test, true), ''), '(not run)') as result
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
-- End of 0015_member_portal_verify.sql
