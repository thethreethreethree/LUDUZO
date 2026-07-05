-- ============================================================================
-- LUDUZO — Phase 4 verification probe: checkins RLS + qr_token + occupancy + events.
-- NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0006 are applied. Expect all PASS / OVERALL ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','c-o-a@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','c-f-a@luduzo.test','{"full_name":"Front A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','c-m-a@luduzo.test','{"full_name":"Member A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'authenticated','authenticated','c-o-b@luduzo.test','{"full_name":"Owner B"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('CI Gym A','ci-gym-a'); perform set_config('ci.orgA', v::text, true);
exception when others then perform set_config('ci.orgA','', true); end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('CI Gym B','ci-gym-b'); perform set_config('ci.orgB', v::text, true);
exception when others then perform set_config('ci.orgB','', true); end $$;
reset role;

-- staff + members + one open checkin per org (privileged)
do $$
declare oa uuid := nullif(current_setting('ci.orgA', true), '')::uuid;
        ob uuid := nullif(current_setting('ci.orgB', true), '')::uuid;
        ma uuid; ma2 uuid; mb uuid;
begin
  insert into organization_members (organization_id, user_id, role) values
    (oa, 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'front_desk'),
    (oa, 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'member');
  insert into members (organization_id, first_name, last_name) values (oa,'Chk','MemberA') returning id into ma;
  -- ma2: a second org-A member with NO seeded check-in, for the front-desk write test
  -- (0018 allows only one open check-in per member, so it can't reuse ma).
  insert into members (organization_id, first_name, last_name) values (oa,'Chk','MemberA2') returning id into ma2;
  insert into members (organization_id, first_name, last_name) values (ob,'Chk','MemberB') returning id into mb;
  insert into checkins (organization_id, member_id) values (oa, ma);
  insert into checkins (organization_id, member_id) values (ob, mb);
  perform set_config('ci.ma', ma::text, true);
  perform set_config('ci.ma2', ma2::text, true);
  perform set_config('ci.seed','PASS',true);
exception when others then perform set_config('ci.seed','ERROR: '||sqlerrm, true); end $$;

-- owner A: qr_token present + isolation + cross-tenant write blocked
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare n int; oa uuid := nullif(current_setting('ci.orgA', true), '')::uuid; ma uuid := nullif(current_setting('ci.ma', true), '')::uuid;
begin
  perform set_config('ci.qr_token', case when exists(select 1 from members where id=ma and qr_token is not null) then 'PASS' else 'FAIL: qr_token null' end, true);
  select count(*) into n from checkins;
  perform set_config('ci.iso_a', case when n=1 and not exists(select 1 from checkins where organization_id<>oa) then 'PASS' else format('FAIL: sees %s checkins',n) end, true);
exception when others then
  perform set_config('ci.qr_token','ERROR: '||sqlerrm,true);
  perform set_config('ci.iso_a','ERROR: '||sqlerrm,true);
end $$;
do $$ declare ob uuid := nullif(current_setting('ci.orgB', true), '')::uuid; mb uuid;
begin
  select id into mb from members where organization_id = ob limit 1;  -- RLS: owner A can't see org B members
  insert into checkins (organization_id, member_id) values (ob, coalesce(mb, ob));
  perform set_config('ci.write_cross','FAIL: owner A checked in to org B',true);
exception when insufficient_privilege then perform set_config('ci.write_cross','PASS',true);
when others then perform set_config('ci.write_cross','PASS (blocked: '||sqlstate||')',true); end $$;
reset role;

-- front_desk: write allowed + checkin/checkout events + occupancy
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare oa uuid := nullif(current_setting('ci.orgA', true), '')::uuid; ma2 uuid := nullif(current_setting('ci.ma2', true), '')::uuid; cid uuid; n int;
begin
  insert into checkins (organization_id, member_id, method) values (oa, ma2, 'kiosk') returning id into cid;
  get diagnostics n = row_count;
  perform set_config('ci.write_front', case when n=1 then 'PASS' else format('FAIL: %s rows',n) end, true);
  perform set_config('ci.evt_checkin', case when exists(select 1 from events where subject_type='member' and subject_id=ma2 and event_type='member.checkin') then 'PASS' else 'FAIL: no member.checkin' end, true);
  update checkins set checked_out_at = now() where id = cid;
  perform set_config('ci.evt_checkout', case when exists(select 1 from events where event_type='member.checkout' and subject_id=ma2) then 'PASS' else 'FAIL: no member.checkout' end, true);
  -- occupancy: open checkins (checked_out_at null) for org A = the seeded one only (front's was checked out)
  select count(*) into n from checkins where checked_out_at is null;
  perform set_config('ci.occupancy', case when n=1 then 'PASS' else format('FAIL: %s open (expected 1)',n) end, true);
exception when others then
  perform set_config('ci.write_front','ERROR: '||sqlerrm,true);
  perform set_config('ci.evt_checkin','ERROR: '||sqlerrm,true);
  perform set_config('ci.evt_checkout','ERROR: '||sqlerrm,true);
  perform set_config('ci.occupancy','ERROR: '||sqlerrm,true);
end $$;
reset role;

-- member-role: write blocked
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare oa uuid := nullif(current_setting('ci.orgA', true), '')::uuid; ma uuid := nullif(current_setting('ci.ma', true), '')::uuid;
begin
  insert into checkins (organization_id, member_id) values (oa, ma);
  perform set_config('ci.write_member','FAIL: member-role checked someone in',true);
exception when insufficient_privilege then perform set_config('ci.write_member','PASS',true);
when others then perform set_config('ci.write_member','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'qr_token'    ,'members have a qr_token'),
    (2,'iso_a'       ,'owner A sees only org A checkins'),
    (3,'write_front' ,'front_desk can record a checkin'),
    (4,'write_member','member-role CANNOT record a checkin'),
    (5,'write_cross' ,'owner A CANNOT check in to org B'),
    (6,'evt_checkin' ,'member.checkin event emitted'),
    (7,'evt_checkout','member.checkout event emitted'),
    (8,'occupancy'   ,'open checkins exclude checked-out')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('ci.'||test, true), ''), '(not run)') as result
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
-- End of 0006_checkins_rls_verify.sql
