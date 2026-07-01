-- ============================================================================
-- LUDUZO — group member-read probe: a linked customer sees their group link.
-- NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0003, 0015, 0019, 0023 are applied. Expect ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','gm-owner@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','ccccccc9-cccc-cccc-cccc-cccccccccccc',
     'authenticated','authenticated','gm-customer@luduzo.test','{"full_name":"Customer"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('GM Gym A','gm-gym-a'); perform set_config('gm.orgA', v::text, true);
exception when others then perform set_config('gm.orgA','', true); end $$;
reset role;

do $$
declare oa uuid := nullif(current_setting('gm.orgA', true), '')::uuid; mine uuid; other uuid; grp uuid;
begin
  insert into members (organization_id, first_name, last_name, profile_id)
    values (oa,'Cust','Omer','ccccccc9-cccc-cccc-cccc-cccccccccccc') returning id into mine;
  insert into members (organization_id, first_name, last_name) values (oa,'Other','Person') returning id into other;
  insert into member_groups (organization_id, name, group_type) values (oa,'Smith Family','family') returning id into grp;
  insert into member_group_links (organization_id, group_id, member_id) values (oa, grp, mine), (oa, grp, other);
  perform set_config('gm.seed','PASS',true);
exception when others then perform set_config('gm.seed','ERROR: '||sqlerrm, true); end $$;

-- customer: sees their own link (1, not the other member's) and can read the group name.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','ccccccc9-cccc-cccc-cccc-cccccccccccc','role','authenticated')::text, true);
do $$ declare n int;
begin
  select count(*) into n from member_group_links;
  perform set_config('gm.own_link', case when n=1 then 'PASS' else format('FAIL: sees %s links',n) end, true);
  select count(*) into n from member_groups;
  perform set_config('gm.reads_group', case when n=1 then 'PASS' else format('FAIL: sees %s groups',n) end, true);
exception when others then
  perform set_config('gm.own_link','ERROR: '||sqlerrm,true);
  perform set_config('gm.reads_group','ERROR: '||sqlerrm,true);
end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'own_link'    ,'member sees only their own group link'),
    (2,'reads_group' ,'member can read their gym group name')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('gm.'||test, true), ''), '(not run)') as result
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
-- End of 0023_group_member_read_verify.sql
