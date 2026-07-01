-- ============================================================================
-- LUDUZO — Member PWA self-service RLS (member-facing writes + schedule reads).
--
-- Governed by: §3.2 (RLS is the structural guarantee), A5 (ripple-traced), A12.
-- Every member policy is bound to the caller's OWN member records
-- (auth_member_ids) AND their org (auth_member_org_ids) — no cross-tenant writes.
--
-- ⚠ STATUS: NOT YET APPLIED. The direct-Postgres host was unreachable at authoring
-- time (DNS EAI_AGAIN on db.<ref>.supabase.co). Apply via the Supabase dashboard
-- SQL editor (API path), or re-run the migration runner once the host resolves.
-- Until applied, the member self-service UI (book/log/join) will be RLS-denied.
-- ============================================================================

-- ---- Read the class schedule (browse to book) ----
drop policy if exists classes_select_member on classes;
create policy classes_select_member on classes for select
  using (organization_id in (select auth_member_org_ids()));

drop policy if exists class_sessions_select_member on class_sessions;
create policy class_sessions_select_member on class_sessions for select
  using (organization_id in (select auth_member_org_ids()));

-- ---- Self-book / self-cancel a class ----
drop policy if exists bookings_member_insert on bookings;
create policy bookings_member_insert on bookings for insert
  with check (member_id in (select auth_member_ids())
              and organization_id in (select auth_member_org_ids()));

drop policy if exists bookings_member_cancel on bookings;
create policy bookings_member_cancel on bookings for update
  using (member_id in (select auth_member_ids()))
  with check (member_id in (select auth_member_ids()));

-- ---- Self-log a body measurement ----
drop policy if exists member_measurements_member_insert on member_measurements;
create policy member_measurements_member_insert on member_measurements for insert
  with check (member_id in (select auth_member_ids())
              and organization_id in (select auth_member_org_ids()));

-- ---- Join a challenge ----
drop policy if exists challenge_participants_member_insert on challenge_participants;
create policy challenge_participants_member_insert on challenge_participants for insert
  with check (member_id in (select auth_member_ids())
              and organization_id in (select auth_member_org_ids()));

-- ---- Record own consent (GDPR) ----
drop policy if exists consent_records_member_insert on consent_records;
create policy consent_records_member_insert on consent_records for insert
  with check (member_id in (select auth_member_ids())
              and organization_id in (select auth_member_org_ids()));

-- End of 0034_member_self_service.sql
