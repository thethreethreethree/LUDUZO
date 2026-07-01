-- ============================================================================
-- LUDUZO — Check-in uniqueness probe: at most one open check-in per member.
-- NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0006, 0018 are applied. Expect ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','ci2-o-a@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('CI2 Gym A','ci2-gym-a'); perform set_config('ci2.orgA', v::text, true);
exception when others then perform set_config('ci2.orgA','', true); end $$;
reset role;

do $$
declare oa uuid := nullif(current_setting('ci2.orgA', true), '')::uuid; ma uuid;
begin
  insert into members (organization_id, first_name, last_name) values (oa,'Uniq','MemberA') returning id into ma;
  insert into checkins (organization_id, member_id) values (oa, ma);   -- first open check-in
  perform set_config('ci2.ma', ma::text, true);
  perform set_config('ci2.seed','PASS',true);
exception when others then perform set_config('ci2.seed','ERROR: '||sqlerrm, true); end $$;

-- second OPEN check-in for the same member -> rejected by the partial unique index
do $$ declare oa uuid := nullif(current_setting('ci2.orgA', true), '')::uuid; ma uuid := nullif(current_setting('ci2.ma', true), '')::uuid;
begin
  insert into checkins (organization_id, member_id) values (oa, ma);
  perform set_config('ci2.second_blocked','FAIL: duplicate open check-in allowed',true);
exception when unique_violation then perform set_config('ci2.second_blocked','PASS',true);
when others then perform set_config('ci2.second_blocked','UNEXPECTED: '||sqlerrm,true); end $$;

-- after checking out, a NEW check-in is allowed again
do $$ declare oa uuid := nullif(current_setting('ci2.orgA', true), '')::uuid; ma uuid := nullif(current_setting('ci2.ma', true), '')::uuid; n int;
begin
  update checkins set checked_out_at = now() where member_id = ma and checked_out_at is null;
  insert into checkins (organization_id, member_id) values (oa, ma);
  get diagnostics n = row_count;
  perform set_config('ci2.reentry', case when n=1 then 'PASS' else format('FAIL: %s rows',n) end, true);
exception when others then perform set_config('ci2.reentry','UNEXPECTED: '||sqlerrm,true); end $$;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'second_blocked','a second OPEN check-in is rejected'),
    (2,'reentry'       ,'re-entry allowed after check-out')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('ci2.'||test, true), ''), '(not run)') as result
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
-- End of 0018_checkin_unique_verify.sql
