-- ============================================================================
-- LUDUZO — add/update a staff member by email. Builds on 0001.
--
-- An owner/admin adds an EXISTING app user (by email) to their org with a role,
-- or updates that person's role. SECURITY DEFINER so it can look up the user by
-- email and write organization_members, after verifying the caller is owner/admin.
--
-- FLAGGED (still deferred): emailing a signup invite to someone WITHOUT an account.
--   This function only links people who have already signed up. Full invite flow
--   needs an email provider + token design — a founder decision.
--
-- Governed by: CLAUDE.md §1.5.1 L1 · §7 (RBAC) · A12. UNTESTED until run.
-- ============================================================================

create or replace function add_staff_member(p_org uuid, p_email text, p_role app_role)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid;
begin
  if auth.uid() is null then
    raise exception 'add_staff_member: not authenticated';
  end if;
  if not auth_has_org_role(p_org, array['owner','admin']::app_role[]) then
    raise exception 'add_staff_member: only owner/admin may add staff' using errcode = 'insufficient_privilege';
  end if;

  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then
    raise exception 'add_staff_member: no user with that email — they must sign up first';
  end if;

  insert into organization_members (organization_id, user_id, role)
  values (p_org, v_uid, p_role)
  on conflict (organization_id, user_id) do update set role = excluded.role, status = 'active';

  return v_uid;
end$$;

grant execute on function add_staff_member(uuid, text, app_role) to authenticated;

-- End of 0021_add_staff.sql
