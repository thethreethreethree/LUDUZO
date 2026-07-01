-- ============================================================================
-- LUDUZO — add_staff_member probe: owner adds a user; non-admin cannot.
-- NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0021 are applied. Expect ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','st-owner@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','st-member@luduzo.test','{"full_name":"Member A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','ddddddd5-dddd-dddd-dddd-dddddddddddd',
     'authenticated','authenticated','st-new-staff@luduzo.test','{"full_name":"New Staff"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('ST Gym A','st-gym-a'); perform set_config('st.orgA', v::text, true);
exception when others then perform set_config('st.orgA','', true); end $$;
reset role;

do $$ declare oa uuid := nullif(current_setting('st.orgA', true), '')::uuid;
begin
  insert into organization_members (organization_id, user_id, role) values
    (oa, 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'member');
  perform set_config('st.seed','PASS',true);
exception when others then perform set_config('st.seed','ERROR: '||sqlerrm, true); end $$;

-- owner adds a new staff member by email
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare oa uuid := nullif(current_setting('st.orgA', true), '')::uuid; u uuid;
begin
  u := add_staff_member(oa, 'st-new-staff@luduzo.test', 'front_desk');
  perform set_config('st.owner_adds',
    case when exists(select 1 from organization_members where organization_id=oa and user_id=u and role='front_desk')
         then 'PASS' else 'FAIL: not added' end, true);
exception when others then perform set_config('st.owner_adds','ERROR: '||sqlerrm,true); end $$;
-- unknown email -> error
do $$ declare oa uuid := nullif(current_setting('st.orgA', true), '')::uuid;
begin
  perform add_staff_member(oa, 'nobody@nowhere.test', 'front_desk');
  perform set_config('st.unknown_email','FAIL: added a non-existent user',true);
exception when others then perform set_config('st.unknown_email','PASS',true); end $$;
reset role;

-- non-admin (member role) cannot add staff
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare oa uuid := nullif(current_setting('st.orgA', true), '')::uuid;
begin
  perform add_staff_member(oa, 'st-new-staff@luduzo.test', 'admin');
  perform set_config('st.member_blocked','FAIL: member added staff',true);
exception when insufficient_privilege then perform set_config('st.member_blocked','PASS',true);
when others then perform set_config('st.member_blocked','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'owner_adds'    ,'owner adds an existing user as staff'),
    (2,'unknown_email' ,'adding an unknown email is rejected'),
    (3,'member_blocked','non-admin CANNOT add staff')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('st.'||test, true), ''), '(not run)') as result
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
-- End of 0021_add_staff_verify.sql
