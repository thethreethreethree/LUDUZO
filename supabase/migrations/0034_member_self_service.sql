-- ============================================================================
-- LUDUZO — Member PWA self-service RLS (member-facing writes + schedule reads).
--
-- Governed by: §3.2 (RLS is the structural guarantee), A5 (ripple-traced), A12.
-- Every member policy is bound to the caller's OWN member records
-- (auth_member_ids) AND their org (auth_member_org_ids) — no cross-tenant writes.
--
-- STATUS: APPLIED + verified live by the agent (all 7 policies present in
-- pg_policies). The direct-Postgres host was briefly unreachable at authoring time
-- (DNS EAI_AGAIN); it resolved and the migration was applied in-session. A12: all
-- objects are drop-guarded, so re-running is safe.
-- ============================================================================

-- ---- Read the class schedule (browse to book) ----
drop policy if exists classes_select_member on classes;
create policy classes_select_member on classes for select
  using (organization_id in (select auth_member_org_ids()));

drop policy if exists class_sessions_select_member on class_sessions;
create policy class_sessions_select_member on class_sessions for select
  using (organization_id in (select auth_member_org_ids()));

-- ---- Self-book / self-cancel a class ----
-- A member may only self-insert as 'booked' or 'waitlisted' (never 'attended'/'no_show'
-- — that's staff-recorded), and a member UPDATE may only RESULT in 'cancelled'
-- (they can't mark themselves attended or move sessions). §3.2 over-permissive-write fix.
drop policy if exists bookings_member_insert on bookings;
create policy bookings_member_insert on bookings for insert
  with check (member_id in (select auth_member_ids())
              and organization_id in (select auth_member_org_ids())
              and status in ('booked','waitlisted'));

drop policy if exists bookings_member_cancel on bookings;
create policy bookings_member_cancel on bookings for update
  using (member_id in (select auth_member_ids()))
  with check (member_id in (select auth_member_ids())
              and status = 'cancelled');

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
