-- ============================================================================
-- LUDUZO — Phase 5+ verification probe: announcements RLS.
-- NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0009 are applied. Expect all PASS / OVERALL ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','an-o-a@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','an-m-a@luduzo.test','{"full_name":"Member A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'authenticated','authenticated','an-o-b@luduzo.test','{"full_name":"Owner B"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('AN Gym A','an-gym-a'); perform set_config('an.orgA', v::text, true);
exception when others then perform set_config('an.orgA','', true); end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('AN Gym B','an-gym-b'); perform set_config('an.orgB', v::text, true);
exception when others then perform set_config('an.orgB','', true); end $$;
reset role;

do $$
declare oa uuid := nullif(current_setting('an.orgA', true), '')::uuid;
        ob uuid := nullif(current_setting('an.orgB', true), '')::uuid;
begin
  insert into organization_members (organization_id, user_id, role) values
    (oa, 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'member');
  insert into announcements (organization_id, title) values (oa,'Welcome A'), (ob,'Welcome B');
  perform set_config('an.seed','PASS',true);
exception when others then perform set_config('an.seed','ERROR: '||sqlerrm, true); end $$;

-- owner A: isolation + create allowed + cross blocked
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare n int; oa uuid := nullif(current_setting('an.orgA', true), '')::uuid;
begin
  select count(*) into n from announcements;
  perform set_config('an.iso_a', case when n=1 and not exists(select 1 from announcements where organization_id<>oa) then 'PASS' else format('FAIL: sees %s',n) end, true);
  insert into announcements (organization_id, title) values (oa, 'Holiday hours');
  get diagnostics n = row_count;
  perform set_config('an.write_owner', case when n=1 then 'PASS' else format('FAIL: %s rows',n) end, true);
exception when others then
  perform set_config('an.iso_a','ERROR: '||sqlerrm,true);
  perform set_config('an.write_owner','ERROR: '||sqlerrm,true);
end $$;
do $$ declare ob uuid := nullif(current_setting('an.orgB', true), '')::uuid;
begin
  insert into announcements (organization_id, title) values (ob, 'Cross');
  perform set_config('an.write_cross','FAIL: owner A wrote into org B',true);
exception when insufficient_privilege then perform set_config('an.write_cross','PASS',true);
when others then perform set_config('an.write_cross','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- member-role: can read, cannot write
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare n int; begin
  select count(*) into n from announcements;
  perform set_config('an.read_member', case when n >= 1 then 'PASS' else format('FAIL: member sees %s',n) end, true);
exception when others then perform set_config('an.read_member','ERROR: '||sqlerrm,true); end $$;
do $$ declare oa uuid := nullif(current_setting('an.orgA', true), '')::uuid; begin
  insert into announcements (organization_id, title) values (oa, 'Member post');
  perform set_config('an.write_member','FAIL: member wrote an announcement',true);
exception when insufficient_privilege then perform set_config('an.write_member','PASS',true);
when others then perform set_config('an.write_member','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'iso_a'       ,'owner A sees only org A announcements'),
    (2,'write_owner' ,'owner can post an announcement'),
    (3,'read_member' ,'member-role can READ announcements'),
    (4,'write_member','member-role CANNOT post'),
    (5,'write_cross' ,'owner A CANNOT post into org B')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('an.'||test, true), ''), '(not run)') as result
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
-- End of 0009_announcements_rls_verify.sql
