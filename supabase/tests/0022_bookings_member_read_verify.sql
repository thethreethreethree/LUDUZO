-- ============================================================================
-- LUDUZO — bookings member-read probe: a linked customer sees their booking.
-- NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0007, 0015, 0022 are applied. Expect ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','bk-owner@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','ccccccc9-cccc-cccc-cccc-cccccccccccc',
     'authenticated','authenticated','bk-customer@luduzo.test','{"full_name":"Customer"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('BK Gym A','bk-gym-a'); perform set_config('bk.orgA', v::text, true);
exception when others then perform set_config('bk.orgA','', true); end $$;
reset role;

-- customer is a linked member with a booking; another member also has a booking.
do $$
declare oa uuid := nullif(current_setting('bk.orgA', true), '')::uuid; mine uuid; other uuid; ca uuid; sa uuid;
begin
  insert into members (organization_id, first_name, last_name, profile_id)
    values (oa,'Cust','Omer','ccccccc9-cccc-cccc-cccc-cccccccccccc') returning id into mine;
  insert into members (organization_id, first_name, last_name) values (oa,'Other','Person') returning id into other;
  insert into classes (organization_id, name) values (oa,'Spin') returning id into ca;
  insert into class_sessions (organization_id, class_id, starts_at) values (oa, ca, now() + interval '1 day') returning id into sa;
  insert into bookings (organization_id, session_id, member_id) values (oa, sa, mine), (oa, sa, other);
  perform set_config('bk.seed','PASS',true);
exception when others then perform set_config('bk.seed','ERROR: '||sqlerrm, true); end $$;

-- customer: sees ONLY their own booking (1), not the other member's.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','ccccccc9-cccc-cccc-cccc-cccccccccccc','role','authenticated')::text, true);
do $$ declare n int;
begin
  select count(*) into n from bookings;
  perform set_config('bk.member_sees_own', case when n=1 then 'PASS' else format('FAIL: sees %s bookings',n) end, true);
exception when others then perform set_config('bk.member_sees_own','ERROR: '||sqlerrm,true); end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'member_sees_own','linked member sees only their own booking'),
    (2,'seed'           ,'fixtures seeded')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('bk.'||test, true), ''), '(not run)') as result
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
-- End of 0022_bookings_member_read_verify.sql
