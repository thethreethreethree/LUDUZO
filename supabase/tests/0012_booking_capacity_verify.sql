-- ============================================================================
-- LUDUZO — Booking capacity verification probe (no overbooking).
-- NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0007, 0012 are applied. Expect ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','cap-o-a@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('CAP Gym A','cap-gym-a'); perform set_config('cap.orgA', v::text, true);
exception when others then perform set_config('cap.orgA','', true); end $$;
reset role;

-- seed: a class + a session with capacity 1, and two members (privileged)
do $$
declare oa uuid := nullif(current_setting('cap.orgA', true), '')::uuid; ca uuid; sa uuid; m1 uuid; m2 uuid;
begin
  insert into classes (organization_id, name) values (oa,'Pilates') returning id into ca;
  insert into class_sessions (organization_id, class_id, starts_at, capacity) values (oa, ca, now() + interval '1 day', 1) returning id into sa;
  insert into members (organization_id, first_name, last_name) values (oa,'M','One') returning id into m1;
  insert into members (organization_id, first_name, last_name) values (oa,'M','Two') returning id into m2;
  perform set_config('cap.sa', sa::text, true);
  perform set_config('cap.m1', m1::text, true);
  perform set_config('cap.m2', m2::text, true);
  perform set_config('cap.seed','PASS',true);
exception when others then perform set_config('cap.seed','ERROR: '||sqlerrm, true); end $$;

-- owner: first booking OK; second (over capacity) rejected; after cancel, slot frees
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare sa uuid := nullif(current_setting('cap.sa', true), '')::uuid; m1 uuid := nullif(current_setting('cap.m1', true), '')::uuid; n int; bid uuid;
begin
  insert into bookings (organization_id, session_id, member_id) values (nullif(current_setting('cap.orgA', true), '')::uuid, sa, m1) returning id into bid;
  get diagnostics n = row_count;
  perform set_config('cap.first_ok', case when n=1 then 'PASS' else format('FAIL: %s rows',n) end, true);
  perform set_config('cap.bid', bid::text, true);
exception when others then perform set_config('cap.first_ok','ERROR: '||sqlerrm,true); end $$;
do $$ declare sa uuid := nullif(current_setting('cap.sa', true), '')::uuid; m2 uuid := nullif(current_setting('cap.m2', true), '')::uuid;
begin
  insert into bookings (organization_id, session_id, member_id) values (nullif(current_setting('cap.orgA', true), '')::uuid, sa, m2);
  perform set_config('cap.over_blocked','FAIL: overbooking allowed',true);
exception when check_violation then perform set_config('cap.over_blocked','PASS',true);
when others then perform set_config('cap.over_blocked','UNEXPECTED: '||sqlerrm,true); end $$;
do $$ declare sa uuid := nullif(current_setting('cap.sa', true), '')::uuid; m2 uuid := nullif(current_setting('cap.m2', true), '')::uuid; bid uuid := nullif(current_setting('cap.bid', true), '')::uuid; n int;
begin
  update bookings set status='cancelled' where id=bid;   -- frees the slot
  insert into bookings (organization_id, session_id, member_id) values (nullif(current_setting('cap.orgA', true), '')::uuid, sa, m2);
  get diagnostics n = row_count;
  perform set_config('cap.refill', case when n=1 then 'PASS' else format('FAIL: %s rows',n) end, true);
exception when others then perform set_config('cap.refill','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'first_ok'    ,'first booking accepted (capacity 1)'),
    (2,'over_blocked','second booking rejected (full)'),
    (3,'refill'      ,'cancelling frees the slot for a new booking')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('cap.'||test, true), ''), '(not run)') as result
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
-- End of 0012_booking_capacity_verify.sql
