-- ============================================================================
-- LUDUZO — Phase 2 (secondary) verification probe: documents RLS + sign event.
-- NOT a migration. Rollback-safe; renders a result GRID (A14).
-- Run AFTER 0001, 0002, 0004 are applied. Expect all PASS / OVERALL ALL PASS.
--
-- ⚠ SCOPE: this covers the TABLE policies (document_templates, member_documents)
--   and the sign event only. It does NOT exercise the storage.objects policies
--   from 0004 — those require the Storage API and must be validated manually.
--
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','do-a@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','df-a@luduzo.test','{"full_name":"Front A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','dm-a@luduzo.test','{"full_name":"Member A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'authenticated','authenticated','do-b@luduzo.test','{"full_name":"Owner B"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('DOC Gym A','doc-gym-a'); perform set_config('doc.orgA', v::text, true);
exception when others then perform set_config('doc.orgA','', true); end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('DOC Gym B','doc-gym-b'); perform set_config('doc.orgB', v::text, true);
exception when others then perform set_config('doc.orgB','', true); end $$;
reset role;

-- staff + seed members / templates / documents (privileged)
do $$
declare oa uuid := nullif(current_setting('doc.orgA', true), '')::uuid;
        ob uuid := nullif(current_setting('doc.orgB', true), '')::uuid;
        ma uuid; mb uuid; doca uuid;
begin
  insert into organization_members (organization_id, user_id, role) values
    (oa, 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'front_desk'),
    (oa, 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'member');
  insert into members (organization_id, first_name, last_name) values (oa,'Doc','MemberA') returning id into ma;
  insert into members (organization_id, first_name, last_name) values (ob,'Doc','MemberB') returning id into mb;
  insert into document_templates (organization_id, title, kind) values (oa,'Liability Waiver','waiver'), (ob,'B Waiver','waiver');
  insert into member_documents (organization_id, member_id, kind, status) values (oa, ma, 'waiver','pending') returning id into doca;
  insert into member_documents (organization_id, member_id, kind, status) values (ob, mb, 'waiver','pending');
  perform set_config('doc.docA', doca::text, true);
  perform set_config('doc.seed','PASS',true);
exception when others then perform set_config('doc.seed','ERROR: '||sqlerrm, true); end $$;

-- owner A: isolation + cross-tenant write blocked
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare n int; oa uuid := nullif(current_setting('doc.orgA', true), '')::uuid;
begin
  select count(*) into n from document_templates;
  perform set_config('doc.iso_templates_a', case when n=1 and not exists(select 1 from document_templates where organization_id<>oa) then 'PASS' else format('FAIL: sees %s templates',n) end, true);
  select count(*) into n from member_documents;
  perform set_config('doc.iso_docs_a', case when n=1 and not exists(select 1 from member_documents where organization_id<>oa) then 'PASS' else format('FAIL: sees %s docs',n) end, true);
exception when others then
  perform set_config('doc.iso_templates_a','ERROR: '||sqlerrm,true);
  perform set_config('doc.iso_docs_a','ERROR: '||sqlerrm,true);
end $$;
do $$ declare ob uuid := nullif(current_setting('doc.orgB', true), '')::uuid;
begin
  insert into document_templates (organization_id, title) values (ob, 'Cross Template');
  perform set_config('doc.write_cross','FAIL: owner A wrote into org B',true);
exception when insufficient_privilege then perform set_config('doc.write_cross','PASS',true);
when others then perform set_config('doc.write_cross','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- owner B: isolation
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb','role','authenticated')::text, true);
do $$ declare n int; ob uuid := nullif(current_setting('doc.orgB', true), '')::uuid;
begin
  select count(*) into n from member_documents;
  perform set_config('doc.iso_docs_b', case when n=1 and not exists(select 1 from member_documents where organization_id<>ob) then 'PASS' else format('FAIL: sees %s docs',n) end, true);
exception when others then perform set_config('doc.iso_docs_b','ERROR: '||sqlerrm,true); end $$;
reset role;

-- front_desk: write allowed + sign event
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare oa uuid := nullif(current_setting('doc.orgA', true), '')::uuid; doca uuid := nullif(current_setting('doc.docA', true), '')::uuid; n int;
begin
  insert into document_templates (organization_id, title, kind) values (oa, 'Membership Contract', 'contract');
  get diagnostics n = row_count;
  perform set_config('doc.write_front', case when n=1 then 'PASS' else format('FAIL: %s rows',n) end, true);
  update member_documents set status='signed', signed_at=now() where id=doca;
  perform set_config('doc.evt_signed',
    case when exists(select 1 from events where subject_type='member_document' and subject_id=doca and event_type='document.signed')
         then 'PASS' else 'FAIL: document.signed not emitted' end, true);
exception when others then
  perform set_config('doc.write_front','ERROR: '||sqlerrm,true);
  perform set_config('doc.evt_signed','ERROR: '||sqlerrm,true);
end $$;
reset role;

-- member-role: write blocked
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare oa uuid := nullif(current_setting('doc.orgA', true), '')::uuid;
begin
  insert into document_templates (organization_id, title) values (oa, 'Should Fail');
  perform set_config('doc.write_member','FAIL: member-role wrote a template',true);
exception when insufficient_privilege then perform set_config('doc.write_member','PASS',true);
when others then perform set_config('doc.write_member','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'iso_templates_a','owner A sees only org A templates'),
    (2,'iso_docs_a'     ,'owner A sees only org A member_documents'),
    (3,'iso_docs_b'     ,'owner B sees only org B member_documents'),
    (4,'write_front'    ,'front_desk can write a template'),
    (5,'write_member'   ,'member-role CANNOT write a template'),
    (6,'write_cross'    ,'owner A CANNOT write into org B'),
    (7,'evt_signed'     ,'document.signed event emitted on sign')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('doc.'||test, true), ''), '(not run)') as result
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
-- End of 0004_documents_rls_verify.sql
