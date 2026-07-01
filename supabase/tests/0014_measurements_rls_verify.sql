-- ============================================================================
-- LUDUZO — Measurements verification probe: RLS (trainer writes; member-role can't).
-- NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0014 are applied. Expect ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','me-o-a@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','me-t-a@luduzo.test','{"full_name":"Trainer A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','me-m-a@luduzo.test','{"full_name":"Member A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'authenticated','authenticated','me-o-b@luduzo.test','{"full_name":"Owner B"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('ME Gym A','me-gym-a'); perform set_config('me.orgA', v::text, true);
exception when others then perform set_config('me.orgA','', true); end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('ME Gym B','me-gym-b'); perform set_config('me.orgB', v::text, true);
exception when others then perform set_config('me.orgB','', true); end $$;
reset role;

do $$
declare oa uuid := nullif(current_setting('me.orgA', true), '')::uuid;
        ob uuid := nullif(current_setting('me.orgB', true), '')::uuid;
        ma uuid; mb uuid;
begin
  insert into organization_members (organization_id, user_id, role) values
    (oa, 'aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'trainer'),
    (oa, 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'member');
  insert into members (organization_id, first_name, last_name) values (oa,'Me','MemberA') returning id into ma;
  insert into members (organization_id, first_name, last_name) values (ob,'Me','MemberB') returning id into mb;
  insert into member_measurements (organization_id, member_id, weight_kg) values (oa, ma, 80.0), (ob, mb, 70.0);
  perform set_config('me.ma', ma::text, true);
  perform set_config('me.seed','PASS',true);
exception when others then perform set_config('me.seed','ERROR: '||sqlerrm, true); end $$;

-- owner A: isolation + cross blocked
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare n int; oa uuid := nullif(current_setting('me.orgA', true), '')::uuid;
begin
  select count(*) into n from member_measurements;
  perform set_config('me.iso_a', case when n=1 and not exists(select 1 from member_measurements where organization_id<>oa) then 'PASS' else format('FAIL: sees %s',n) end, true);
exception when others then perform set_config('me.iso_a','ERROR: '||sqlerrm,true); end $$;
do $$ declare ob uuid := nullif(current_setting('me.orgB', true), '')::uuid; mb uuid;
begin
  insert into member_measurements (organization_id, member_id, weight_kg) values (ob, gen_random_uuid(), 1);
  perform set_config('me.write_cross','FAIL: owner A wrote into org B',true);
exception when others then
  -- FK violation OR RLS both acceptable as "blocked"
  perform set_config('me.write_cross', case when sqlstate in ('42501','23503') then 'PASS' else 'UNEXPECTED: '||sqlstate end, true);
end $$;
reset role;

-- trainer: can write measurement for org A member
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare oa uuid := nullif(current_setting('me.orgA', true), '')::uuid; ma uuid := nullif(current_setting('me.ma', true), '')::uuid; n int;
begin
  insert into member_measurements (organization_id, member_id, weight_kg) values (oa, ma, 79.5);
  get diagnostics n = row_count;
  perform set_config('me.write_trainer', case when n=1 then 'PASS' else format('FAIL: %s rows',n) end, true);
exception when others then perform set_config('me.write_trainer','ERROR: '||sqlerrm,true); end $$;
reset role;

-- member-role: cannot write
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare oa uuid := nullif(current_setting('me.orgA', true), '')::uuid; ma uuid := nullif(current_setting('me.ma', true), '')::uuid;
begin
  insert into member_measurements (organization_id, member_id, weight_kg) values (oa, ma, 1);
  perform set_config('me.write_member','FAIL: member wrote a measurement',true);
exception when insufficient_privilege then perform set_config('me.write_member','PASS',true);
when others then perform set_config('me.write_member','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'iso_a'        ,'owner A sees only org A measurements'),
    (2,'write_trainer','trainer can log a measurement'),
    (3,'write_member' ,'member-role CANNOT log a measurement'),
    (4,'write_cross'  ,'owner A CANNOT write into org B')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('me.'||test, true), ''), '(not run)') as result
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
-- End of 0014_measurements_rls_verify.sql
