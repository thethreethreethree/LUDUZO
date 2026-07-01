-- ============================================================================
-- LUDUZO — POS verification probe: record_sale() authorization + effects.
-- NOT a migration. Rollback-safe; result GRID (A14).
-- Run AFTER 0001, 0002, 0005, 0008, 0011 are applied. Expect ALL PASS.
-- STATUS: AUTHORED, UNTESTED until run.
-- ============================================================================

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','po-o-a@luduzo.test','{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','po-f-a@luduzo.test','{"full_name":"Front A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'authenticated','authenticated','po-m-a@luduzo.test','{"full_name":"Member A"}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare v uuid; begin v := create_organization('PO Gym A','po-gym-a'); perform set_config('po.orgA', v::text, true);
exception when others then perform set_config('po.orgA','', true); end $$;
reset role;

do $$
declare oa uuid := nullif(current_setting('po.orgA', true), '')::uuid; pid uuid;
begin
  insert into organization_members (organization_id, user_id, role) values
    (oa, 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'front_desk'),
    (oa, 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'member');
  insert into products (organization_id, name, price_cents, stock_quantity) values (oa,'Bar',300,10) returning id into pid;
  perform set_config('po.pid', pid::text, true);
  perform set_config('po.seed','PASS',true);
exception when others then perform set_config('po.seed','ERROR: '||sqlerrm, true); end $$;

-- front_desk: record_sale succeeds, decrements stock, creates paid invoice + event
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare pid uuid := nullif(current_setting('po.pid', true), '')::uuid; inv uuid; stock int;
begin
  inv := record_sale(pid, 2);
  perform set_config('po.sale', case when inv is not null then 'PASS' else 'FAIL: no invoice' end, true);
  select stock_quantity into stock from products where id = pid;
  perform set_config('po.stock', case when stock = 8 then 'PASS' else format('FAIL: stock=%s (expected 8)', stock) end, true);
  perform set_config('po.invoice_paid', case when exists(select 1 from invoices where id=inv and status='paid' and amount_cents=600) then 'PASS' else 'FAIL: invoice not paid/600' end, true);
  perform set_config('po.event', case when exists(select 1 from events where event_type='sale.recorded' and subject_id=pid) then 'PASS' else 'FAIL: no sale.recorded' end, true);
exception when others then
  perform set_config('po.sale','ERROR: '||sqlerrm,true);
  perform set_config('po.stock','ERROR: '||sqlerrm,true);
  perform set_config('po.invoice_paid','ERROR: '||sqlerrm,true);
  perform set_config('po.event','ERROR: '||sqlerrm,true);
end $$;
reset role;

-- member-role: record_sale is rejected (not staff)
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaaa','role','authenticated')::text, true);
do $$ declare pid uuid := nullif(current_setting('po.pid', true), '')::uuid;
begin
  perform record_sale(pid, 1);
  perform set_config('po.member_blocked','FAIL: member recorded a sale',true);
exception when insufficient_privilege then perform set_config('po.member_blocked','PASS',true);
when others then perform set_config('po.member_blocked','UNEXPECTED: '||sqlerrm,true); end $$;
reset role;

-- ---------- RESULT GRID ----------
with results(ord, test, descr) as (
  values
    (1,'sale'          ,'front_desk record_sale returns an invoice'),
    (2,'stock'         ,'stock decremented (10 - 2 = 8)'),
    (3,'invoice_paid'  ,'paid invoice for 600 cents created'),
    (4,'event'         ,'sale.recorded event emitted'),
    (5,'member_blocked','member-role CANNOT record a sale')
),
evaluated as (
  select ord, test, descr,
         coalesce(nullif(current_setting('po.'||test, true), ''), '(not run)') as result
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
-- End of 0011_pos_sale_verify.sql
