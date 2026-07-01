-- ============================================================================
-- LUDUZO — Phase 5+ verification probe: products / equipment RLS.
-- NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0008 are applied. Expect all PASS / OVERALL ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','in-o-a@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','in-f-a@luduzo.test','{"full_name":"Front A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'authenticated','authenticated','in-o-b@luduzo.test','{"full_name":"Owner B"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('IN Gym A','in-gym-a'); perform set_config('in.orgA', v::text, true);
exception when others then perform set_config('in.orgA','', true); end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('IN Gym B','in-gym-b'); perform set_config('in.orgB', v::text, true);
exception when others then perform set_config('in.orgB','', true); end $$;
reset role;

do $$
declare oa uuid := nullif(current_setting('in.orgA', true), '')::uuid;
        ob uuid := nullif(current_setting('in.orgB', true), '')::uuid;
begin
  insert into organization_members (organization_id, user_id, role) values
    (oa, 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'front_desk');
  insert into products (organization_id, name, price_cents) values (oa,'Protein Bar',300), (ob,'B Bar',300);
  insert into equipment (organization_id, name) values (oa,'Treadmill 1'), (ob,'B Treadmill');
  perform set_config('in.seed','PASS',true);
exception when others then perform set_config('in.seed','ERROR: '||sqlerrm, true); end $$;

-- owner A: isolation + create allowed + cross blocked
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare n int; oa uuid := nullif(current_setting('in.orgA', true), '')::uuid;
begin
  select count(*) into n from products;
  perform set_config('in.iso_products_a', case when n=1 and not exists(select 1 from products where organization_id<>oa) then 'PASS' else format('FAIL: sees %s products',n) end, true);
  select count(*) into n from equipment;
  perform set_config('in.iso_equip_a', case when n=1 and not exists(select 1 from equipment where organization_id<>oa) then 'PASS' else format('FAIL: sees %s equipment',n) end, true);
  insert into products (organization_id, name, price_cents) values (oa, 'Shaker', 1500);
  get diagnostics n = row_count;
  perform set_config('in.write_owner', case when n=1 then 'PASS' else format('FAIL: %s rows',n) end, true);
exception when others then
  perform set_config('in.iso_products_a','ERROR: '||sqlerrm,true);
  perform set_config('in.iso_equip_a','ERROR: '||sqlerrm,true);
  perform set_config('in.write_owner','ERROR: '||sqlerrm,true);
end $$;
do $$ declare ob uuid := nullif(current_setting('in.orgB', true), '')::uuid;
begin
  insert into products (organization_id, name, price_cents) values (ob, 'Cross', 1);
  perform set_config('in.write_cross','FAIL: owner A wrote product into org B',true);
exception when insufficient_privilege then perform set_config('in.write_cross','PASS',true);
when others then perform set_config('in.write_cross','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- front_desk: cannot write (management only)
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare oa uuid := nullif(current_setting('in.orgA', true), '')::uuid;
begin
  insert into products (organization_id, name, price_cents) values (oa, 'Front Product', 1);
  perform set_config('in.write_front','FAIL: front_desk wrote a product',true);
exception when insufficient_privilege then perform set_config('in.write_front','PASS',true);
when others then perform set_config('in.write_front','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'iso_products_a','owner A sees only org A products'),
    (2,'iso_equip_a'   ,'owner A sees only org A equipment'),
    (3,'write_owner'   ,'owner can create a product'),
    (4,'write_front'   ,'front_desk CANNOT create a product (mgmt only)'),
    (5,'write_cross'   ,'owner A CANNOT write product into org B')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('in.'||test, true), ''), '(not run)') as result
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
-- End of 0008_inventory_rls_verify.sql
