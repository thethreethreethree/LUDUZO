-- ============================================================================
-- LUDUZO — Member announcement-read probe: a linked customer reads gym news.
-- NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0009, 0015, 0019 are applied. Expect ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','an2-owner@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','ccccccc9-cccc-cccc-cccc-cccccccccccc',
     'authenticated','authenticated','an2-customer@luduzo.test','{"full_name":"Customer"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'authenticated','authenticated','an2-owner-b@luduzo.test','{"full_name":"Owner B"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('AN2 Gym A','an2-gym-a'); perform set_config('an2.orgA', v::text, true);
exception when others then perform set_config('an2.orgA','', true); end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('AN2 Gym B','an2-gym-b'); perform set_config('an2.orgB', v::text, true);
exception when others then perform set_config('an2.orgB','', true); end $$;
reset role;

-- customer is a linked member of org A; org A has a published announcement; org B has one too.
do $$
declare oa uuid := nullif(current_setting('an2.orgA', true), '')::uuid;
        ob uuid := nullif(current_setting('an2.orgB', true), '')::uuid;
begin
  insert into members (organization_id, first_name, last_name, profile_id)
    values (oa, 'Cust', 'Omer', 'ccccccc9-cccc-cccc-cccc-cccccccccccc');
  insert into announcements (organization_id, title, published) values (oa, 'Holiday hours', true), (ob, 'B news', true);
  perform set_config('an2.seed','PASS',true);
exception when others then perform set_config('an2.seed','ERROR: '||sqlerrm, true); end $$;

-- customer: sees org A's announcement only (not org B's), and cannot write.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','ccccccc9-cccc-cccc-cccc-cccccccccccc','role','authenticated')::text, true);
do $$ declare n int; oa uuid := nullif(current_setting('an2.orgA', true), '')::uuid;
begin
  select count(*) into n from announcements;
  perform set_config('an2.member_reads', case when n=1 and not exists(select 1 from announcements where organization_id<>oa) then 'PASS' else format('FAIL: sees %s',n) end, true);
exception when others then perform set_config('an2.member_reads','ERROR: '||sqlerrm,true); end $$;
do $$ declare oa uuid := nullif(current_setting('an2.orgA', true), '')::uuid;
begin
  insert into announcements (organization_id, title) values (oa, 'Member post');
  perform set_config('an2.member_no_write','FAIL: member posted an announcement',true);
exception when insufficient_privilege then perform set_config('an2.member_no_write','PASS',true);
when others then perform set_config('an2.member_no_write','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'member_reads'   ,'linked member reads own gym announcements only'),
    (2,'member_no_write','member still cannot post')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('an2.'||test, true), ''), '(not run)') as result
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
-- End of 0019_member_announcements_verify.sql
