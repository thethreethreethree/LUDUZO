-- ============================================================================
-- LUDUZO — Member self-edit of own name + phone (accepted rec #7a).
--
-- Governed by: §3.2 (RLS/structural) · §3.3 (guide, don't overtake) · A12.
-- Founder decision (2026-07-02): members MAY edit their own NAME; email stays
-- front-desk-only (email drives link_my_member_records). Supersedes the phone-only
-- update_my_contact (0037) with a column-restricted profile RPC that writes ONLY
-- first_name / last_name / phone for the caller's own member rows — never email,
-- status, member_number, org, etc.
--
-- ⚠ STATUS: authored while the direct-Postgres host was unreachable — UNAPPLIED /
-- UNVERIFIED. The /more name form is NOT deployed until this is applied, because an
-- unapplied RPC would silently fail to save the name. Apply via the Supabase SQL
-- editor or the runner when the host resolves. A12: create-or-replace.
-- ============================================================================

create or replace function update_my_profile(p_first_name text, p_last_name text, p_phone text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_first text := nullif(trim(coalesce(p_first_name, '')), '');
  v_last  text := nullif(trim(coalesce(p_last_name, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
begin
  if v_uid is null then
    raise exception 'update_my_profile: not authenticated';
  end if;
  if v_first is null or v_last is null then
    raise exception 'update_my_profile: first and last name are required';
  end if;
  if length(v_first) > 60 or length(v_last) > 60 or (v_phone is not null and length(v_phone) > 40) then
    raise exception 'update_my_profile: value too long';
  end if;

  -- Only the caller's own member rows; only these three columns.
  update members
     set first_name = v_first,
         last_name  = v_last,
         phone      = v_phone
   where profile_id = v_uid;
end $$;

grant execute on function update_my_profile(text, text, text) to authenticated;

-- End of 0045_member_update_profile.sql
