-- ============================================================================
-- LUDUZO — Public Storage bucket for gym brand logos (owner uploads an image in
-- Settings; the member app shows it top-right).
--
-- Governed by: §3.2 (storage RLS is the load-bearing guard) · A5 (RLS ripple) ·
--   A12 (safe-to-rerun). Follows the proven 0004 storage pattern (path = <org_id>/…,
--   auth_org_ids_for_roles, storage.foldername) — but PUBLIC so member apps can
--   render the logo via a public URL without auth.
--
-- ⚠ STATUS: UNAPPLIED / UNVERIFIED — storage.objects policies are Supabase-version-
-- specific and the probe can't exercise them. Apply via the Supabase SQL editor;
-- until then the Settings logo upload shows a friendly "storage not set up" error
-- (graceful). A12: bucket on-conflict, policies drop-if-exists.
-- ============================================================================

insert into storage.buckets (id, name, public)
  values ('brand', 'brand', true)
  on conflict (id) do update set public = true;

-- Public read: logos render in members' webapps (and anywhere) without a session.
drop policy if exists brand_storage_read on storage.objects;
create policy brand_storage_read on storage.objects for select
  using (bucket_id = 'brand');

-- Write/replace/delete: only owner/admin of the org whose folder the path targets
-- (path convention: <org_id>/logo-*.<ext>).
drop policy if exists brand_storage_write on storage.objects;
create policy brand_storage_write on storage.objects for all to authenticated
  using (
    bucket_id = 'brand'
    and (storage.foldername(name))[1] in (
      select x::text from auth_org_ids_for_roles(array['owner','admin']::app_role[]) as x)
  )
  with check (
    bucket_id = 'brand'
    and (storage.foldername(name))[1] in (
      select x::text from auth_org_ids_for_roles(array['owner','admin']::app_role[]) as x)
  );

-- End of 0061_brand_bucket.sql
