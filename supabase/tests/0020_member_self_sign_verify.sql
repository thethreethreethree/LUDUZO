-- ============================================================================
-- LUDUZO — member self-sign probe: sign own doc; cannot sign someone else's.
-- NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0004, 0015, 0020 are applied. Expect ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','ss-owner@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','ccccccc9-cccc-cccc-cccc-cccccccccccc',
     'authenticated','authenticated','ss-customer@luduzo.test','{"full_name":"Customer"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('SS Gym A','ss-gym-a'); perform set_config('ss.orgA', v::text, true);
exception when others then perform set_config('ss.orgA','', true); end $$;
reset role;

-- customer linked to a member with a pending doc; plus another member's pending doc.
do $$
declare oa uuid := nullif(current_setting('ss.orgA', true), '')::uuid; mine uuid; other uuid; dmine uuid; dother uuid;
begin
  insert into members (organization_id, first_name, last_name, profile_id)
    values (oa,'Cust','Omer','ccccccc9-cccc-cccc-cccc-cccccccccccc') returning id into mine;
  insert into members (organization_id, first_name, last_name) values (oa,'Other','Person') returning id into other;
  insert into member_documents (organization_id, member_id, kind, status) values (oa, mine, 'waiver','pending') returning id into dmine;
  insert into member_documents (organization_id, member_id, kind, status) values (oa, other, 'waiver','pending') returning id into dother;
  perform set_config('ss.dmine', dmine::text, true);
  perform set_config('ss.dother', dother::text, true);
  perform set_config('ss.seed','PASS',true);
exception when others then perform set_config('ss.seed','ERROR: '||sqlerrm, true); end $$;

-- customer signs OWN doc (allowed) and CANNOT sign the other member's doc.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','ccccccc9-cccc-cccc-cccc-cccccccccccc','role','authenticated')::text, true);
do $$ declare dmine uuid := nullif(current_setting('ss.dmine', true), '')::uuid;
begin
  perform sign_my_document(dmine);
  perform set_config('ss.sign_own',
    case when exists(select 1 from member_documents where id=dmine and status='signed') then 'PASS' else 'FAIL: not signed' end, true);
exception when others then perform set_config('ss.sign_own','ERROR: '||sqlerrm,true); end $$;
do $$ declare dother uuid := nullif(current_setting('ss.dother', true), '')::uuid;
begin
  perform sign_my_document(dother);
  perform set_config('ss.sign_other','FAIL: signed another member''s doc',true);
exception when insufficient_privilege then perform set_config('ss.sign_other','PASS',true);
when others then perform set_config('ss.sign_other','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'sign_own'  ,'customer signs their own pending document'),
    (2,'sign_other','customer CANNOT sign another member''s document')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('ss.'||test, true), ''), '(not run)') as result
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
-- End of 0020_member_self_sign_verify.sql
