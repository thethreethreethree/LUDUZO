-- ============================================================================
-- LUDUZO — Fix found by the F3 smoke test (audit remediation).
--
-- BUG: suspend_overdue_members (0027) filtered invoices on status='past_due', but
--   'past_due' is a SUBSCRIPTION status, not an invoice_status (draft/open/paid/
--   void/uncollectible). The function could therefore never match — auto-suspension
--   was dead. §1.5.1 L2 (did not work) + §3.4 (implied a working feature).
--
-- FIX: define "overdue" correctly as an OPEN invoice past its due_date. A12: replace.
-- ============================================================================

create or replace function suspend_overdue_members(p_org uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not auth_has_org_role(p_org, array['owner','admin','manager']::app_role[]) then
    raise exception 'suspend_overdue_members: not authorized' using errcode = 'insufficient_privilege';
  end if;
  with overdue as (
    select distinct member_id from invoices
    where organization_id = p_org
      and status = 'open'
      and due_date is not null and due_date < current_date
      and member_id is not null
  )
  update members m set status = 'frozen'
  from overdue o
  where m.id = o.member_id and m.organization_id = p_org and m.status = 'active';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- End of 0033_suspend_overdue_fix.sql
