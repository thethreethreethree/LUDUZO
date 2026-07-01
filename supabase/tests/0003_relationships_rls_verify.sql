-- ============================================================================
-- LUDUZO — Phase 2 (secondary) verification probe: member_groups / guest_passes /
-- referrals RLS. NOT a migration. Rollback-safe; renders a result GRID (A14).
-- Run AFTER 0001, 0002, 0003 are applied. Expect all PASS / OVERALL ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','o-a@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','f-a@luduzo.test','{"full_name":"Front A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','m-a@luduzo.test','{"full_name":"Member A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'authenticated','authenticated','o-b@luduzo.test','{"full_name":"Owner B"}'::jsonb, now(), now());

-- onboarding
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('REL Gym A','rel-gym-a'); perform set_config('rel.orgA', v::text, true);
exception when others then perform set_config('rel.orgA','', true); end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('REL Gym B','rel-gym-b'); perform set_config('rel.orgB', v::text, true);
exception when others then perform set_config('rel.orgB','', true); end $$;
reset role;

-- staff + seed rows (privileged)
do $$
declare oa uuid := nullif(current_setting('rel.orgA', true), '')::uuid;
        ob uuid := nullif(current_setting('rel.orgB', true), '')::uuid;
begin
  insert into organization_members (organization_id, user_id, role) values
    (oa, 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'front_desk'),
    (oa, 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'member');
  insert into member_groups (organization_id, name, group_type) values
    (oa, 'Smith Family', 'family'), (oa, 'Acme Corp', 'corporate'), (ob, 'B Family', 'family');
  insert into guest_passes (organization_id, guest_name) values (oa, 'Guest One'), (ob, 'Guest B');
  insert into referrals (organization_id, referred_name) values (oa, 'Ref One'), (ob, 'Ref B');
  perform set_config('rel.seed','PASS',true);
exception when others then perform set_config('rel.seed','ERROR: '||sqlerrm, true); end $$;

-- owner A: isolation across all three tables + cross-tenant write blocked
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare n int; oa uuid := nullif(current_setting('rel.orgA', true), '')::uuid;
begin
  select count(*) into n from member_groups;
  perform set_config('rel.iso_groups_a', case when n=2 and not exists(select 1 from member_groups where organization_id<>oa) then 'PASS' else format('FAIL: sees %s groups',n) end, true);
  select count(*) into n from guest_passes;
  perform set_config('rel.iso_guests_a', case when n=1 and not exists(select 1 from guest_passes where organization_id<>oa) then 'PASS' else format('FAIL: sees %s guest passes',n) end, true);
  select count(*) into n from referrals;
  perform set_config('rel.iso_refs_a', case when n=1 and not exists(select 1 from referrals where organization_id<>oa) then 'PASS' else format('FAIL: sees %s referrals',n) end, true);
exception when others then
  perform set_config('rel.iso_groups_a','ERROR: '||sqlerrm,true);
  perform set_config('rel.iso_guests_a','ERROR: '||sqlerrm,true);
  perform set_config('rel.iso_refs_a','ERROR: '||sqlerrm,true);
end $$;
do $$ declare ob uuid := nullif(current_setting('rel.orgB', true), '')::uuid;
begin
  insert into member_groups (organization_id, name) values (ob, 'Cross Group');
  perform set_config('rel.write_cross','FAIL: owner A wrote into org B',true);
exception when insufficient_privilege then perform set_config('rel.write_cross','PASS',true);
when others then perform set_config('rel.write_cross','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- owner B: isolation
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb','role','authenticated')::text, true);
do $$ declare n int; ob uuid := nullif(current_setting('rel.orgB', true), '')::uuid;
begin
  select count(*) into n from member_groups;
  perform set_config('rel.iso_groups_b', case when n=1 and not exists(select 1 from member_groups where organization_id<>ob) then 'PASS' else format('FAIL: sees %s groups',n) end, true);
exception when others then perform set_config('rel.iso_groups_b','ERROR: '||sqlerrm,true); end $$;
reset role;

-- front_desk: write allowed
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare oa uuid := nullif(current_setting('rel.orgA', true), '')::uuid; n int;
begin
  insert into member_groups (organization_id, name, group_type) values (oa, 'Desk Family', 'family');
  get diagnostics n = row_count;
  perform set_config('rel.write_front', case when n=1 then 'PASS' else format('FAIL: %s rows',n) end, true);
exception when others then perform set_config('rel.write_front','ERROR: '||sqlerrm,true); end $$;
reset role;

-- member-role: write blocked
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare oa uuid := nullif(current_setting('rel.orgA', true), '')::uuid;
begin
  insert into member_groups (organization_id, name) values (oa, 'Should Fail');
  perform set_config('rel.write_member','FAIL: member-role wrote a group',true);
exception when insufficient_privilege then perform set_config('rel.write_member','PASS',true);
when others then perform set_config('rel.write_member','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'iso_groups_a' ,'owner A sees only org A member_groups'),
    (2,'iso_groups_b' ,'owner B sees only org B member_groups'),
    (3,'iso_guests_a' ,'owner A sees only org A guest_passes'),
    (4,'iso_refs_a'   ,'owner A sees only org A referrals'),
    (5,'write_front'  ,'front_desk can write a group'),
    (6,'write_member' ,'member-role CANNOT write a group'),
    (7,'write_cross'  ,'owner A CANNOT write into org B')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('rel.'||test, true), ''), '(not run)') as result
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
-- End of 0003_relationships_rls_verify.sql
