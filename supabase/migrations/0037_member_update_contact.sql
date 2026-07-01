-- ============================================================================
-- LUDUZO — Member self-edit of their OWN phone number (portal profile).
--
-- Governed by: §3.2 (RLS/structural guarantee) · §3.3 (guide, don't overtake) ·
--   A12 (guarded). Mirrors the sign_my_document / link_my_member_records pattern.
--
-- WHY an RPC and not an UPDATE policy: an RLS policy scopes the ROW (own member
-- record) but CANNOT restrict WHICH COLUMNS are written — a broad member-update
-- policy would let a member rewrite status, member_number, org, etc. A
-- SECURITY DEFINER function that only ever touches `phone` is the tight surface:
-- the member can correct their contact number and nothing else.
--
-- DELIBERATELY OUT OF SCOPE (founder decision, flagged): first_name / last_name /
-- email / date_of_birth. Email in particular drives link_my_member_records
-- (email-match linking), and name/DOB are identity fields staff may treat as
-- authoritative. Which of these a member may self-edit is a product call, not a
-- default to be silently chosen. Phone is the unambiguously-safe slice.
-- ============================================================================

create or replace function update_my_contact(p_phone text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
begin
  if v_uid is null then
    raise exception 'update_my_contact: not authenticated';
  end if;
  if v_phone is not null and length(v_phone) > 40 then
    raise exception 'update_my_contact: phone too long';
  end if;

  -- Only the caller's OWN linked member rows, only the phone column.
  update members set phone = v_phone
  where profile_id = v_uid;
end $$;

grant execute on function update_my_contact(text) to authenticated;

-- End of 0037_member_update_contact.sql
