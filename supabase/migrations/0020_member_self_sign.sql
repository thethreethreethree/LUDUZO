-- ============================================================================
-- LUDUZO — member self-sign: a customer signs their OWN pending document.
-- Builds on 0004 (member_documents) + 0015 (member linkage).
--
-- member_documents_write (0004) is staff-only. Rather than widen it (which would
-- let a member edit any field), a SECURITY DEFINER function verifies the document
-- belongs to the caller and flips it to 'signed' only. The status change fires the
-- 0004 document.signed event trigger.
--
-- Governed by: CLAUDE.md §3.3 (the user acts on their own record) · §1.5.1 L1 · A12.
-- STATUS: UNTESTED until run.
-- ============================================================================

create or replace function sign_my_document(p_doc_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_member uuid;
begin
  select member_id into v_member from member_documents where id = p_doc_id;
  if v_member is null then
    raise exception 'sign_my_document: document not found';
  end if;
  if not exists (select 1 from members where id = v_member and profile_id = auth.uid()) then
    raise exception 'sign_my_document: not your document' using errcode = 'insufficient_privilege';
  end if;

  update member_documents
     set status = 'signed', signed_at = now()
   where id = p_doc_id and status <> 'signed';
end$$;

grant execute on function sign_my_document(uuid) to authenticated;

-- End of 0020_member_self_sign.sql
