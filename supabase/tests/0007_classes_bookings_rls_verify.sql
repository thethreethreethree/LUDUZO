-- ============================================================================
-- LUDUZO — Phase 5 verification probe: classes / sessions / bookings RLS + events.
-- NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0007 are applied. Expect all PASS / OVERALL ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','cl-o-a@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','cl-f-a@luduzo.test','{"full_name":"Front A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'authenticated','authenticated','cl-o-b@luduzo.test','{"full_name":"Owner B"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('CL Gym A','cl-gym-a'); perform set_config('cl.orgA', v::text, true);
exception when others then perform set_config('cl.orgA','', true); end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('CL Gym B','cl-gym-b'); perform set_config('cl.orgB', v::text, true);
exception when others then perform set_config('cl.orgB','', true); end $$;
reset role;

-- staff + classes/sessions/members (privileged)
do $$
declare oa uuid := nullif(current_setting('cl.orgA', true), '')::uuid;
        ob uuid := nullif(current_setting('cl.orgB', true), '')::uuid;
        ca uuid; sa uuid; ma uuid;
begin
  insert into organization_members (organization_id, user_id, role) values
    (oa, 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'front_desk');
  insert into classes (organization_id, name) values (oa,'Spin') returning id into ca;
  insert into classes (organization_id, name) values (ob,'B Spin');
  insert into class_sessions (organization_id, class_id, starts_at) values (oa, ca, now() + interval '1 day') returning id into sa;
  insert into members (organization_id, first_name, last_name) values (oa,'Cls','MemberA') returning id into ma;
  perform set_config('cl.sa', sa::text, true);
  perform set_config('cl.ma', ma::text, true);
  perform set_config('cl.seed','PASS',true);
exception when others then perform set_config('cl.seed','ERROR: '||sqlerrm, true); end $$;

-- owner A: isolation + create class allowed + cross blocked
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare n int; oa uuid := nullif(current_setting('cl.orgA', true), '')::uuid;
begin
  select count(*) into n from classes;
  perform set_config('cl.iso_classes_a', case when n=1 and not exists(select 1 from classes where organization_id<>oa) then 'PASS' else format('FAIL: sees %s classes',n) end, true);
  insert into classes (organization_id, name) values (oa, 'Yoga');
  get diagnostics n = row_count;
  perform set_config('cl.write_class_owner', case when n=1 then 'PASS' else format('FAIL: %s rows',n) end, true);
exception when others then
  perform set_config('cl.iso_classes_a','ERROR: '||sqlerrm,true);
  perform set_config('cl.write_class_owner','ERROR: '||sqlerrm,true);
end $$;
do $$ declare ob uuid := nullif(current_setting('cl.orgB', true), '')::uuid;
begin
  insert into classes (organization_id, name) values (ob, 'Cross Class');
  perform set_config('cl.write_cross','FAIL: owner A wrote class into org B',true);
exception when insufficient_privilege then perform set_config('cl.write_cross','PASS',true);
when others then perform set_config('cl.write_cross','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- front_desk: cannot create a class (mgmt only); can create a booking (+ event)
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare oa uuid := nullif(current_setting('cl.orgA', true), '')::uuid;
begin
  insert into classes (organization_id, name) values (oa, 'Front Class');
  perform set_config('cl.write_class_front','FAIL: front_desk created a class',true);
exception when insufficient_privilege then perform set_config('cl.write_class_front','PASS',true);
when others then perform set_config('cl.write_class_front','UNEXPECTED: '||sqlerrm,true); end $$;
do $$ declare oa uuid := nullif(current_setting('cl.orgA', true), '')::uuid;
            sa uuid := nullif(current_setting('cl.sa', true), '')::uuid;
            ma uuid := nullif(current_setting('cl.ma', true), '')::uuid;
            bid uuid; n int;
begin
  insert into bookings (organization_id, session_id, member_id) values (oa, sa, ma) returning id into bid;
  get diagnostics n = row_count;
  perform set_config('cl.write_booking_front', case when n=1 then 'PASS' else format('FAIL: %s rows',n) end, true);
  perform set_config('cl.evt_booking', case when exists(select 1 from events where subject_type='booking' and subject_id=bid and event_type='booking.created') then 'PASS' else 'FAIL: booking.created not emitted' end, true);
exception when others then
  perform set_config('cl.write_booking_front','ERROR: '||sqlerrm,true);
  perform set_config('cl.evt_booking','ERROR: '||sqlerrm,true);
end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'iso_classes_a'    ,'owner A sees only org A classes'),
    (2,'write_class_owner','owner can create a class'),
    (3,'write_class_front','front_desk CANNOT create a class (mgmt only)'),
    (4,'write_booking_front','front_desk can create a booking'),
    (5,'write_cross'      ,'owner A CANNOT write class into org B'),
    (6,'evt_booking'      ,'booking.created event emitted')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('cl.'||test, true), ''), '(not run)') as result
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
-- End of 0007_classes_bookings_rls_verify.sql
