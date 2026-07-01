-- ============================================================================
-- LUDUZO — Phase 5+ (engagement): member self-service portal.
-- Builds on 0002 (members), 0004 (member_documents), 0005 (subscriptions),
-- 0006 (checkins), 0014 (member_measurements).
--
-- Lets a signed-in customer read THEIR OWN linked records (member row +
-- subscriptions + documents + measurements + checkins) even when they are not
-- gym staff. Linkage: members.profile_id = auth.uid(). A customer claims their
-- record(s) by matching email via link_my_member_records().
--
-- These are ADDITIVE permissive policies (combined with existing staff policies
-- by OR) — they only widen read access to the caller's OWN rows, never others.
--
-- Governed by: CLAUDE.md §1.5.1 L1 · §3.3 (the user sees what the system sees about
--   them — A10) · A5 (RLS ripple) · A12. UNTESTED until run.
-- ============================================================================

-- Set-returning helper: the caller's own member ids (SECURITY DEFINER, no recursion).
create or replace function auth_member_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from members where profile_id = auth.uid();
$$;
grant execute on function auth_member_ids() to authenticated;

-- members: a customer can read their own member row.
drop policy if exists members_select_own on members;
create policy members_select_own on members for select using (profile_id = auth.uid());

-- own-read for the linked child records.
drop policy if exists subscriptions_select_own on subscriptions;
create policy subscriptions_select_own on subscriptions for select
  using (member_id in (select auth_member_ids()));

drop policy if exists member_documents_select_own on member_documents;
create policy member_documents_select_own on member_documents for select
  using (member_id in (select auth_member_ids()));

drop policy if exists member_measurements_select_own on member_measurements;
create policy member_measurements_select_own on member_measurements for select
  using (member_id in (select auth_member_ids()));

drop policy if exists checkins_select_own on checkins;
create policy checkins_select_own on checkins for select
  using (member_id in (select auth_member_ids()));

-- invoices: a customer can see their own bills (A10).
drop policy if exists invoices_select_own on invoices;
create policy invoices_select_own on invoices for select
  using (member_id in (select auth_member_ids()));

-- Claim: link unclaimed member rows whose email matches the caller's auth email.
create or replace function link_my_member_records()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  n integer;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null or v_email = '' then return 0; end if;

  update members
     set profile_id = auth.uid()
   where profile_id is null
     and lower(email) = lower(v_email);

  get diagnostics n = row_count;
  return n;
end$$;
grant execute on function link_my_member_records() to authenticated;

-- End of 0015_member_portal.sql
