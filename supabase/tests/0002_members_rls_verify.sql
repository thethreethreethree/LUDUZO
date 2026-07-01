-- ============================================================================
-- LUDUZO — Phase 2 (core) verification probe: onboarding + members RLS + events
--
-- NOT a migration. Self-contained, rollback-safe (BEGIN…ROLLBACK). Renders a
-- result GRID (NOTICE output is hidden by the Supabase SQL editor — A14).
-- Run AFTER 0001 and 0002 are applied. Expect all rows PASS / OVERALL ALL PASS.
--
-- Proves:
--   * create_organization() makes the caller an owner and emits an event.
--   * members are tenant-isolated (owner A vs owner B).
--   * member-role app users can READ members; only owner/admin/manager/front_desk WRITE.
--   * cross-tenant member write is blocked.
--   * member.created / member.status_changed events are emitted (§3.1).
--
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

-- ---------- Fixtures (privileged role; RLS bypassed) ----------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','owner-a@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','front-a@luduzo.test','{"full_name":"Front Desk A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','member-a@luduzo.test','{"full_name":"Member A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'authenticated','authenticated','owner-b@luduzo.test','{"full_name":"Owner B"}'::jsonb, now(), now());

-- ---------- Onboarding: each owner creates their gym via the function ----------
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$
declare v uuid;
begin
  v := create_organization('RLS2 Gym A','rls2-gym-a');
  perform set_config('rls2.orgA', v::text, true);
  perform set_config('rls2.t_onboard_a',
    case when exists (select 1 from organization_members
                      where organization_id = v and user_id = auth.uid()
                        and role = 'owner' and status = 'active')
         then 'PASS' else 'FAIL: caller is not owner of created org' end, true);
  perform set_config('rls2.t_onboard_evt',
    case when exists (select 1 from events where organization_id = v and event_type = 'organization.created')
         then 'PASS' else 'FAIL: organization.created event not emitted' end, true);
exception when others then
  perform set_config('rls2.orgA','', true);
  perform set_config('rls2.t_onboard_a','ERROR: '||sqlerrm, true);
  perform set_config('rls2.t_onboard_evt','ERROR: '||sqlerrm, true);
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb','role','authenticated')::text, true);
do $$
declare v uuid;
begin
  v := create_organization('RLS2 Gym B','rls2-gym-b');
  perform set_config('rls2.orgB', v::text, true);
exception when others then
  perform set_config('rls2.orgB','', true);
end $$;
reset role;

-- ---------- Seed staff + members (privileged direct insert) ----------
do $$
declare oa uuid := nullif(current_setting('rls2.orgA', true), '')::uuid;
        ob uuid := nullif(current_setting('rls2.orgB', true), '')::uuid;
begin
  insert into organization_members (organization_id, user_id, role) values
    (oa, 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'front_desk'),
    (oa, 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'member');
  insert into members (organization_id, first_name, last_name, status) values
    (oa, 'Alice', 'Anders', 'active'),
    (oa, 'Aaron', 'Apple',  'active');
  insert into members (organization_id, first_name, last_name, status) values
    (ob, 'Bob', 'Brown', 'active');
  perform set_config('rls2.seed', 'PASS', true);
exception when others then
  perform set_config('rls2.seed', 'ERROR: '||sqlerrm, true);
end $$;

-- ---------- front_desk: write allowed + lifecycle events ----------
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$
declare oa uuid := nullif(current_setting('rls2.orgA', true), '')::uuid; mid uuid; n int;
begin
  insert into members (organization_id, first_name, last_name)
    values (oa, 'Front', 'Created') returning id into mid;
  get diagnostics n = row_count;
  perform set_config('rls2.t_write_front', case when n = 1 then 'PASS' else format('FAIL: %s rows', n) end, true);
  perform set_config('rls2.t_evt_created',
    case when exists (select 1 from events where subject_type='member' and subject_id=mid and event_type='member.created')
         then 'PASS' else 'FAIL: member.created not emitted' end, true);
  update members set status = 'frozen' where id = mid;
  perform set_config('rls2.t_evt_status',
    case when exists (select 1 from events where subject_type='member' and subject_id=mid and event_type='member.status_changed')
         then 'PASS' else 'FAIL: member.status_changed not emitted' end, true);
exception when others then
  perform set_config('rls2.t_write_front','ERROR: '||sqlerrm, true);
  perform set_config('rls2.t_evt_created','ERROR: '||sqlerrm, true);
  perform set_config('rls2.t_evt_status','ERROR: '||sqlerrm, true);
end $$;
reset role;

-- ---------- member-role: read allowed, write blocked ----------
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$
declare n int;
begin
  select count(*) into n from members;
  perform set_config('rls2.t_read_member', case when n >= 2 then 'PASS' else format('FAIL: member-role sees %s', n) end, true);
exception when others then
  perform set_config('rls2.t_read_member','ERROR: '||sqlerrm, true);
end $$;
do $$
declare oa uuid := nullif(current_setting('rls2.orgA', true), '')::uuid;
begin
  insert into members (organization_id, first_name, last_name) values (oa, 'Should', 'Fail');
  perform set_config('rls2.t_write_member', 'FAIL: member-role inserted a member', true);
exception
  when insufficient_privilege then perform set_config('rls2.t_write_member','PASS', true);
  when others then perform set_config('rls2.t_write_member','UNEXPECTED: '||sqlerrm, true);
end $$;
reset role;

-- ---------- owner A: isolation + cross-tenant write blocked ----------
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$
declare n int; oa uuid := nullif(current_setting('rls2.orgA', true), '')::uuid;
begin
  select count(*) into n from members;
  perform set_config('rls2.t_iso_a',
    case when n >= 2 and not exists (select 1 from members where organization_id <> oa)
         then 'PASS' else format('FAIL: owner A sees %s members incl foreign', n) end, true);
exception when others then
  perform set_config('rls2.t_iso_a','ERROR: '||sqlerrm, true);
end $$;
do $$
declare ob uuid := nullif(current_setting('rls2.orgB', true), '')::uuid;
begin
  insert into members (organization_id, first_name, last_name) values (ob, 'Cross', 'Tenant');
  perform set_config('rls2.t_write_cross', 'FAIL: owner A inserted into org B', true);
exception
  when insufficient_privilege then perform set_config('rls2.t_write_cross','PASS', true);
  when others then perform set_config('rls2.t_write_cross','UNEXPECTED: '||sqlerrm, true);
end $$;
reset role;

-- ---------- owner B: sees only org B ----------
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb','role','authenticated')::text, true);
do $$
declare n int; ob uuid := nullif(current_setting('rls2.orgB', true), '')::uuid;
begin
  select count(*) into n from members;
  perform set_config('rls2.t_iso_b',
    case when n = 1 and not exists (select 1 from members where organization_id <> ob)
         then 'PASS' else format('FAIL: owner B sees %s members', n) end, true);
exception when others then
  perform set_config('rls2.t_iso_b','ERROR: '||sqlerrm, true);
end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1 ,'t_onboard_a'  ,'create_organization() makes caller the owner'),
    (2 ,'t_onboard_evt','organization.created event emitted'),
    (3 ,'t_iso_a'      ,'owner A sees only org A members'),
    (4 ,'t_iso_b'      ,'owner B sees only org B members'),
    (5 ,'t_read_member','member-role user can READ members'),
    (6 ,'t_write_front','front_desk can WRITE a member'),
    (7 ,'t_write_member','member-role CANNOT write a member'),
    (8 ,'t_write_cross','owner A CANNOT write into org B'),
    (9 ,'t_evt_created','member.created event emitted'),
    (10,'t_evt_status' ,'member.status_changed event emitted')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('rls2.'||test, true), ''), '(not run)') as result
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
-- End of 0002_members_rls_verify.sql
