-- ============================================================================
-- LUDUZO — Staff bio + specialties, member-visible (§6 Trainers).
--
-- Governed by: §3.2 (RLS) · §3.3 (self-service) · §1.5.1 L3 · A12.
-- Two columns on organization_members (the staff-membership row) + a self-edit RPC
-- so a staff member sets THEIR OWN bio/specialties. Surfaced to members through
-- gym_staff_directory (recreated with the two new columns — name/role/bio/
-- specialties; still no contact PII). v1 sets the same bio across all of the
-- caller's memberships (one bio per person) — flagged if per-gym bios are wanted.
--
-- ⚠ STATUS: authored while the direct-Postgres host was unreachable — UNAPPLIED.
-- Apply via the Supabase SQL editor. The /dashboard/profile editor + Meet-the-team
-- specialties degrade gracefully until then (separate queries / missing-fn note).
-- ============================================================================

alter table organization_members add column if not exists bio text;
alter table organization_members add column if not exists specialties text;

create or replace function update_my_staff_profile(p_bio text, p_specialties text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_bio text := nullif(trim(coalesce(p_bio, '')), '');
  v_spec text := nullif(trim(coalesce(p_specialties, '')), '');
begin
  if v_uid is null then raise exception 'update_my_staff_profile: not authenticated'; end if;
  if (v_bio is not null and length(v_bio) > 600) or (v_spec is not null and length(v_spec) > 200) then
    raise exception 'update_my_staff_profile: value too long';
  end if;
  update organization_members set bio = v_bio, specialties = v_spec where user_id = v_uid;
end $$;
grant execute on function update_my_staff_profile(text, text) to authenticated;

-- Recreate the member-facing directory with bio + specialties (CREATE OR REPLACE
-- appends new columns; existing name/role consumers are unaffected).
create or replace view gym_staff_directory
with (security_invoker = false) as
  select om.organization_id,
         om.user_id,
         p.full_name,
         p.avatar_url,
         om.role::text as role,
         om.bio,
         om.specialties
  from organization_members om
  join profiles p on p.id = om.user_id
  where om.status = 'active'
    and om.organization_id in (select auth_member_org_ids());

grant select on gym_staff_directory to authenticated;

-- End of 0057_staff_profile.sql
