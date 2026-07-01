-- ============================================================================
-- LUDUZO — Communications verification probe: member_communications RLS.
-- NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0017 are applied. Expect ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','cm-o-a@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','cm-m-a@luduzo.test','{"full_name":"Member A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'authenticated','authenticated','cm-o-b@luduzo.test','{"full_name":"Owner B"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('CM Gym A','cm-gym-a'); perform set_config('cm.orgA', v::text, true);
exception when others then perform set_config('cm.orgA','', true); end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('CM Gym B','cm-gym-b'); perform set_config('cm.orgB', v::text, true);
exception when others then perform set_config('cm.orgB','', true); end $$;
reset role;

do $$
declare oa uuid := nullif(current_setting('cm.orgA', true), '')::uuid;
        ob uuid := nullif(current_setting('cm.orgB', true), '')::uuid; ma uuid; mb uuid;
begin
  insert into organization_members (organization_id, user_id, role) values
    (oa, 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'member');
  insert into members (organization_id, first_name, last_name) values (oa,'Cm','MemberA') returning id into ma;
  insert into members (organization_id, first_name, last_name) values (ob,'Cm','MemberB') returning id into mb;
  insert into member_communications (organization_id, member_id, channel, subject) values
    (oa, ma, 'email', 'Welcome'), (ob, mb, 'email', 'Welcome B');
  perform set_config('cm.ma', ma::text, true);
  perform set_config('cm.seed','PASS',true);
exception when others then perform set_config('cm.seed','ERROR: '||sqlerrm, true); end $$;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare n int; oa uuid := nullif(current_setting('cm.orgA', true), '')::uuid; ma uuid := nullif(current_setting('cm.ma', true), '')::uuid;
begin
  select count(*) into n from member_communications;
  perform set_config('cm.iso_a', case when n=1 and not exists(select 1 from member_communications where organization_id<>oa) then 'PASS' else format('FAIL: sees %s',n) end, true);
  insert into member_communications (organization_id, member_id, channel, body) values (oa, ma, 'call', 'called');
  get diagnostics n = row_count;
  perform set_config('cm.write_staff', case when n=1 then 'PASS' else format('FAIL: %s rows',n) end, true);
exception when others then
  perform set_config('cm.iso_a','ERROR: '||sqlerrm,true);
  perform set_config('cm.write_staff','ERROR: '||sqlerrm,true);
end $$;
do $$ declare ob uuid := nullif(current_setting('cm.orgB', true), '')::uuid; mb uuid;
begin
  insert into member_communications (organization_id, member_id, channel) values (ob, gen_random_uuid(), 'note');
  perform set_config('cm.write_cross','FAIL: owner A wrote into org B',true);
exception when others then
  perform set_config('cm.write_cross', case when sqlstate in ('42501','23503') then 'PASS' else 'UNEXPECTED: '||sqlstate end, true);
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare oa uuid := nullif(current_setting('cm.orgA', true), '')::uuid; ma uuid := nullif(current_setting('cm.ma', true), '')::uuid;
begin
  insert into member_communications (organization_id, member_id, channel) values (oa, ma, 'note');
  perform set_config('cm.write_member','FAIL: member wrote a communication',true);
exception when insufficient_privilege then perform set_config('cm.write_member','PASS',true);
when others then perform set_config('cm.write_member','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'iso_a'       ,'owner A sees only org A communications'),
    (2,'write_staff' ,'staff can log a communication'),
    (3,'write_member','member-role CANNOT log a communication'),
    (4,'write_cross' ,'owner A CANNOT write into org B')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('cm.'||test, true), ''), '(not run)') as result
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
-- End of 0017_communications_rls_verify.sql
