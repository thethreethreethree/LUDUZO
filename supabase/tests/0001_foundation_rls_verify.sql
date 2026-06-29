-- ============================================================================
-- LUDUZO — Phase 1 Foundation: RLS / isolation / append-only VERIFICATION PROBE
--
-- This is NOT a migration. Do not place it in supabase/migrations/.
-- Self-contained, rollback-safe probe that PROVES the guarantees migration
-- 0001_foundation.sql only *claims*. Writes nothing permanent: opens a
-- transaction, seeds throwaway fixtures, asserts, returns a result grid, rolls back.
--
-- WHY THIS VERSION RENDERS A GRID (ThinkerThinker A14):
--   v1 reported PASS/FAIL via RAISE NOTICE. The Supabase SQL editor does NOT
--   show NOTICE output in its result grid, so a passing run looked blank —
--   "the state holds X" ≠ "the user sees X". v2 records each verdict into a
--   transaction-local setting and a FINAL SELECT returns the full matrix as
--   ROWS, which the editor DOES render. It also records failures instead of
--   aborting, so one run shows every test's result.
--
-- Governs the Phase 1 EXIT GATE ("RLS verified to isolate tenants" —
-- docs/DEVELOPMENT-PLAN.md) under:
--   CLAUDE.md §1.5.1 layer 1+2 · §1.7 ground-up · §3.1 append-only ·
--   §3.4 honesty (UNVERIFIED until RUN) · ThinkerThinker A14 · A12 · A3.
--
-- HOW TO RUN
--   Paste this whole file into the Supabase SQL editor (or psql) and run it once.
--   Read the result GRID it returns:
--     * Every row should read 'PASS'. The final OVERALL row reads 'ALL PASS'.
--     * Any 'FAIL: ...' / 'ERROR: ...' / 'UNEXPECTED: ...' / '(not run)' is a
--       REAL defect or a test that did not execute — paste the grid back to me.
--   It always ends in ROLLBACK, so re-running is safe and leaves no data.
--
-- READING FAILURES
--   * "ERROR: permission denied for table/function ..." -> the `authenticated`
--     role lacks base privileges; the live app could not read these tables.
--     Real finding, not a test bug.
--   * "FAIL: sees N orgs (expected 1)" with N>1 -> RLS is not isolating tenants.
--
-- STATUS: AUTHORED, UNTESTED. Until this is run against the live DB and the grid
-- returned, the Phase 1 foundation remains UNVERIFIED (§3.4).
-- ============================================================================

begin;

-- ---------- Fixtures (created as the privileged session role; RLS bypassed) ----------
-- Inserting into auth.users fires on_auth_user_created, which auto-creates profiles.
-- If your Supabase build has a NOT-NULL auth.users column without a default that is
-- omitted here, THIS line errors (harmless; we roll back) — tell me the column.
insert into auth.users
  (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','ownerA@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-cccccccccccc',
     'authenticated','authenticated','memberA@luduzo.test','{"full_name":"Member A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'authenticated','authenticated','ownerB@luduzo.test','{"full_name":"Owner B"}'::jsonb, now(), now()),
  -- eeee: unaffiliated (no membership) — used as an insert target in T7.
  ('00000000-0000-0000-0000-000000000000','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     'authenticated','authenticated','noorg@luduzo.test','{"full_name":"No Org"}'::jsonb, now(), now()),
  -- ffff: SUSPENDED member of org B — used in T9 (access-revocation gate).
  ('00000000-0000-0000-0000-000000000000','ffffffff-ffff-ffff-ffff-ffffffffffff',
     'authenticated','authenticated','suspended@luduzo.test','{"full_name":"Suspended B"}'::jsonb, now(), now());

insert into organizations (id, name, slug) values
  ('11111111-1111-1111-1111-1111111111a1','RLS Test Gym A','luduzo-rls-test-a'),
  ('22222222-2222-2222-2222-2222222222b2','RLS Test Gym B','luduzo-rls-test-b');

insert into locations (id, organization_id, name) values
  ('33333333-3333-3333-3333-3333333333a3','11111111-1111-1111-1111-1111111111a1','A — Downtown'),
  ('44444444-4444-4444-4444-4444444444b4','22222222-2222-2222-2222-2222222222b2','B — Uptown');

insert into organization_members (organization_id, user_id, role) values
  ('11111111-1111-1111-1111-1111111111a1','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','owner'),
  ('11111111-1111-1111-1111-1111111111a1','cccccccc-cccc-cccc-cccc-cccccccccccc','member'),
  ('22222222-2222-2222-2222-2222222222b2','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','owner');

-- ffff is linked to org B but SUSPENDED — auth_org_ids() must exclude it (T9).
insert into organization_members (organization_id, user_id, role, status) values
  ('22222222-2222-2222-2222-2222222222b2','ffffffff-ffff-ffff-ffff-ffffffffffff','member','suspended');

insert into events (organization_id, actor_id, event_type) values
  ('11111111-1111-1111-1111-1111111111a1','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','test.seed'),
  ('22222222-2222-2222-2222-2222222222b2','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','test.seed');

-- ======================================================================
-- TEST 1 — Tenant isolation: Owner A sees ONLY org A across every table.
-- ======================================================================
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);

do $$
declare n int;
begin
  select count(*) into n from organizations;
  perform set_config('rlstest.t1a',
    case when n = 1 and not exists (select 1 from organizations where slug='luduzo-rls-test-b')
         then 'PASS' else format('FAIL: sees %s orgs / foreign org visible', n) end, true);

  select count(*) into n from locations;
  perform set_config('rlstest.t1b',
    case when n = 1 then 'PASS' else format('FAIL: sees %s locations (expected 1)', n) end, true);

  select count(*) into n from organization_members;
  perform set_config('rlstest.t1c',
    case when n = 2 then 'PASS' else format('FAIL: sees %s members (expected 2)', n) end, true);

  select count(*) into n from events;
  perform set_config('rlstest.t1d',
    case when n = 1 then 'PASS' else format('FAIL: sees %s events (expected 1)', n) end, true);

  select count(*) into n from profiles;
  perform set_config('rlstest.t1e',
    case when n = 2 and not exists (select 1 from profiles where email='ownerB@luduzo.test')
         then 'PASS' else format('FAIL: sees %s profiles / foreign profile visible', n) end, true);
exception when others then
  perform set_config('rlstest.t1a','ERROR: '||sqlerrm, true);
  perform set_config('rlstest.t1b','ERROR: '||sqlerrm, true);
  perform set_config('rlstest.t1c','ERROR: '||sqlerrm, true);
  perform set_config('rlstest.t1d','ERROR: '||sqlerrm, true);
  perform set_config('rlstest.t1e','ERROR: '||sqlerrm, true);
end $$;
reset role;

-- ======================================================================
-- TEST 2 — Reciprocal isolation: Owner B sees ONLY org B.
-- ======================================================================
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','role','authenticated')::text, true);

do $$
declare n int;
begin
  select count(*) into n from organizations;
  perform set_config('rlstest.t2',
    case when n = 1 and not exists (select 1 from organizations where slug='luduzo-rls-test-a')
         then 'PASS' else format('FAIL: sees %s orgs / foreign org visible', n) end, true);
exception when others then
  perform set_config('rlstest.t2','ERROR: '||sqlerrm, true);
end $$;
reset role;

-- ======================================================================
-- TEST 3 — Role enforcement on organizations UPDATE.
--   member -> 0 rows (blocked);  owner -> 1 row (allowed).
-- ======================================================================
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','cccccccc-cccc-cccc-cccc-cccccccccccc','role','authenticated')::text, true);
do $$
declare n int;
begin
  update organizations set name='hacked-by-member' where id='11111111-1111-1111-1111-1111111111a1';
  get diagnostics n = row_count;
  perform set_config('rlstest.t3a',
    case when n = 0 then 'PASS' else format('FAIL: member updated %s rows (expected 0)', n) end, true);
exception when others then
  perform set_config('rlstest.t3a','ERROR: '||sqlerrm, true);
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$
declare n int;
begin
  update organizations set name='Gym A (renamed by owner)' where id='11111111-1111-1111-1111-1111111111a1';
  get diagnostics n = row_count;
  perform set_config('rlstest.t3b',
    case when n = 1 then 'PASS' else format('FAIL: owner updated %s rows (expected 1)', n) end, true);
exception when others then
  perform set_config('rlstest.t3b','ERROR: '||sqlerrm, true);
end $$;
reset role;

-- ======================================================================
-- TEST 4 — events INSERT scoping (WITH CHECK).
--   cross-tenant insert -> blocked (RLS 42501);  same-tenant -> allowed.
-- ======================================================================
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);

do $$
begin
  insert into events (organization_id, event_type) values ('22222222-2222-2222-2222-2222222222b2','intrusion.attempt');
  perform set_config('rlstest.t4a','FAIL: cross-tenant insert ALLOWED', true);
exception
  when insufficient_privilege then perform set_config('rlstest.t4a','PASS', true);
  when others then perform set_config('rlstest.t4a','UNEXPECTED: '||sqlerrm, true);
end $$;

do $$
declare n int;
begin
  insert into events (organization_id, event_type) values ('11111111-1111-1111-1111-1111111111a1','same.tenant.ok');
  get diagnostics n = row_count;
  perform set_config('rlstest.t4b',
    case when n = 1 then 'PASS' else format('FAIL: same-tenant insert affected %s rows', n) end, true);
exception when others then
  perform set_config('rlstest.t4b','FAIL: same-tenant insert errored: '||sqlerrm, true);
end $$;
reset role;

-- ======================================================================
-- TEST 5 — events append-only (§3.1). Run RLS-bypassed (privileged role) so the
--   row is actually targeted and the BEFORE trigger fires. Proves the guarantee
--   holds "even for service_role", which RLS alone cannot.
-- ======================================================================
do $$
begin
  update events set event_type='tampered' where organization_id='11111111-1111-1111-1111-1111111111a1';
  perform set_config('rlstest.t5a','FAIL: events UPDATE allowed', true);
exception when others then
  perform set_config('rlstest.t5a',
    case when sqlerrm like '%append-only%' then 'PASS' else 'UNEXPECTED: '||sqlerrm end, true);
end $$;

do $$
begin
  delete from events where organization_id='11111111-1111-1111-1111-1111111111a1';
  perform set_config('rlstest.t5b','FAIL: events DELETE allowed', true);
exception when others then
  perform set_config('rlstest.t5b',
    case when sqlerrm like '%append-only%' then 'PASS' else 'UNEXPECTED: '||sqlerrm end, true);
end $$;

-- ======================================================================
-- TEST 6 — locations write policy (loc_write: owner/admin/manager).
--   owner own-org INSERT -> allowed;  owner foreign-org INSERT -> blocked;
--   member own-org INSERT -> blocked (role gate).
-- ======================================================================
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$
declare n int;
begin
  insert into locations (organization_id, name) values ('11111111-1111-1111-1111-1111111111a1','A — owner-created');
  get diagnostics n = row_count;
  perform set_config('rlstest.t6a', case when n = 1 then 'PASS' else format('FAIL: %s rows', n) end, true);
exception when others then
  perform set_config('rlstest.t6a','FAIL: owner location insert errored: '||sqlerrm, true);
end $$;
do $$
begin
  insert into locations (organization_id, name) values ('22222222-2222-2222-2222-2222222222b2','B — intrusion');
  perform set_config('rlstest.t6b','FAIL: cross-tenant location insert ALLOWED', true);
exception
  when insufficient_privilege then perform set_config('rlstest.t6b','PASS', true);
  when others then perform set_config('rlstest.t6b','UNEXPECTED: '||sqlerrm, true);
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','cccccccc-cccc-cccc-cccc-cccccccccccc','role','authenticated')::text, true);
do $$
begin
  insert into locations (organization_id, name) values ('11111111-1111-1111-1111-1111111111a1','A — member-created');
  perform set_config('rlstest.t6c','FAIL: member location insert ALLOWED', true);
exception
  when insufficient_privilege then perform set_config('rlstest.t6c','PASS', true);
  when others then perform set_config('rlstest.t6c','UNEXPECTED: '||sqlerrm, true);
end $$;
reset role;

-- ======================================================================
-- TEST 7 — organization_members write policy (orgmem_write: owner/admin).
--   member add -> blocked;  owner own-org add -> allowed;  owner foreign add -> blocked.
--   (member-negative runs first so the owner-positive can reuse eeee w/o unique clash.)
-- ======================================================================
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','cccccccc-cccc-cccc-cccc-cccccccccccc','role','authenticated')::text, true);
do $$
begin
  insert into organization_members (organization_id, user_id, role)
    values ('11111111-1111-1111-1111-1111111111a1','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','member');
  perform set_config('rlstest.t7c','FAIL: member added a member ALLOWED', true);
exception
  when insufficient_privilege then perform set_config('rlstest.t7c','PASS', true);
  when others then perform set_config('rlstest.t7c','UNEXPECTED: '||sqlerrm, true);
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$
declare n int;
begin
  insert into organization_members (organization_id, user_id, role)
    values ('11111111-1111-1111-1111-1111111111a1','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','member');
  get diagnostics n = row_count;
  perform set_config('rlstest.t7a', case when n = 1 then 'PASS' else format('FAIL: %s rows', n) end, true);
exception when others then
  perform set_config('rlstest.t7a','FAIL: owner member insert errored: '||sqlerrm, true);
end $$;
do $$
begin
  insert into organization_members (organization_id, user_id, role)
    values ('22222222-2222-2222-2222-2222222222b2','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','member');
  perform set_config('rlstest.t7b','FAIL: cross-tenant member insert ALLOWED', true);
exception
  when insufficient_privilege then perform set_config('rlstest.t7b','PASS', true);
  when others then perform set_config('rlstest.t7b','UNEXPECTED: '||sqlerrm, true);
end $$;
reset role;

-- ======================================================================
-- TEST 8 — anon (unauthenticated) sees nothing and cannot write.
-- ======================================================================
set local role anon;
select set_config('request.jwt.claims', json_build_object()::text, true);  -- no 'sub' => auth.uid() is null
do $$
declare n int;
begin
  select count(*) into n from organizations;
  perform set_config('rlstest.t8a', case when n = 0 then 'PASS' else format('FAIL: anon sees %s orgs', n) end, true);
exception
  when insufficient_privilege then perform set_config('rlstest.t8a','PASS (no anon SELECT grant)', true);
  when others then perform set_config('rlstest.t8a','ERROR: '||sqlerrm, true);
end $$;
do $$
declare n int;
begin
  select count(*) into n from events;
  perform set_config('rlstest.t8b', case when n = 0 then 'PASS' else format('FAIL: anon sees %s events', n) end, true);
exception
  when insufficient_privilege then perform set_config('rlstest.t8b','PASS (no anon SELECT grant)', true);
  when others then perform set_config('rlstest.t8b','ERROR: '||sqlerrm, true);
end $$;
do $$
begin
  insert into events (organization_id, event_type) values ('11111111-1111-1111-1111-1111111111a1','anon.write');
  perform set_config('rlstest.t8c','FAIL: anon event insert ALLOWED', true);
exception
  when insufficient_privilege then perform set_config('rlstest.t8c','PASS', true);
  when others then perform set_config('rlstest.t8c','UNEXPECTED: '||sqlerrm, true);
end $$;
reset role;

-- ======================================================================
-- TEST 9 — suspended membership loses access (auth_org_ids filters status='active').
--   ffff is linked to org B but suspended -> must see 0 orgs / 0 events.
-- ======================================================================
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','ffffffff-ffff-ffff-ffff-ffffffffffff','role','authenticated')::text, true);
do $$
declare n int;
begin
  select count(*) into n from organizations;
  perform set_config('rlstest.t9a', case when n = 0 then 'PASS' else format('FAIL: suspended user sees %s orgs', n) end, true);
  select count(*) into n from events;
  perform set_config('rlstest.t9b', case when n = 0 then 'PASS' else format('FAIL: suspended user sees %s events', n) end, true);
exception when others then
  perform set_config('rlstest.t9a','ERROR: '||sqlerrm, true);
  perform set_config('rlstest.t9b','ERROR: '||sqlerrm, true);
end $$;
reset role;

-- ======================================================================
-- RESULT GRID — the editor renders this (the last row-returning statement).
-- ======================================================================
with results(ord, test, descr) as (
  values
    (1 ,'T1a','Owner A sees only own organization'),
    (2 ,'T1b','Owner A sees only own location'),
    (3 ,'T1c','Owner A sees only own members'),
    (4 ,'T1d','Owner A sees only own events'),
    (5 ,'T1e','Owner A sees self + co-member profiles only'),
    (6 ,'T2' ,'Owner B sees only own organization (reciprocal)'),
    (7 ,'T3a','member CANNOT update organization'),
    (8 ,'T3b','owner CAN update organization'),
    (9 ,'T4a','cross-tenant event insert blocked'),
    (10,'T4b','same-tenant event insert allowed'),
    (11,'T5a','events UPDATE blocked (append-only)'),
    (12,'T5b','events DELETE blocked (append-only)'),
    (13,'T6a','owner CAN add location to own org'),
    (14,'T6b','owner CANNOT add location to foreign org'),
    (15,'T6c','member CANNOT add location (role gate)'),
    (16,'T7c','member CANNOT add org member'),
    (17,'T7a','owner CAN add member to own org'),
    (18,'T7b','owner CANNOT add member to foreign org'),
    (19,'T8a','anon sees 0 organizations'),
    (20,'T8b','anon sees 0 events'),
    (21,'T8c','anon CANNOT insert event'),
    (22,'T9a','suspended member sees 0 organizations'),
    (23,'T9b','suspended member sees 0 events')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('rlstest.'||lower(test), true), ''), '(not run)') as result
  from results
)
select ord, test, result, descr from evaluated
union all
select 999, 'OVERALL',
  case when (select bool_and(result like 'PASS%') from evaluated) then 'ALL PASS'
       else 'SEE FAIL / ERROR ROWS ABOVE' end,
  'aggregate verdict'
order by ord;

rollback;  -- pure probe: discard all fixtures, leave the database untouched.
-- End of 0001_foundation_rls_verify.sql
