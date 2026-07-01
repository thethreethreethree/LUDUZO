-- ============================================================================
-- LUDUZO — Phase 2 (secondary): waivers / contracts / policies + signatures,
-- with a private Storage bucket for signed files. Builds on 0001 + 0002.
--
-- Governed by: CLAUDE.md §1.5.1 layer 1 · §1.7 · §3.1 (sign emits an event) ·
--   A12 (safe-to-re-run) · A5 (RLS ripple).
--
-- ⚠ HIGHER-UNCERTAINTY SECTION: the Storage policies operate on the Supabase
--   `storage` schema, which is version-specific. The table policies (templates,
--   member_documents) follow the proven 0001/0002 pattern; the storage.objects
--   policies are AUTHORED but the probe cannot exercise them (needs the Storage
--   API). Validate those manually after applying.
--
-- FLAGGED PRODUCT DECISIONS (defaults; override later):
--   * Signing is STAFF-RECORDED (front desk marks a doc signed). Member self-sign
--     (members.profile_id = auth.uid() updating their own doc) is deferred.
--   * Signature is stored as free-form text/JSON (typed name or a storage path);
--     no e-signature provider is integrated.
--
-- STATUS: UNTESTED until run. A12: all objects guarded.
-- ============================================================================

-- ---------- Enums ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'document_kind') then
    create type document_kind as enum ('waiver','contract','policy');
  end if;
  if not exists (select 1 from pg_type where typname = 'document_status') then
    create type document_status as enum ('pending','signed','declined','expired');
  end if;
end$$;

-- ---------- Set-returning RBAC helper (for storage policies) ----------
-- Returns the org ids where the caller holds one of the given roles (active).
-- SECURITY DEFINER to avoid RLS recursion, consistent with 0001's helpers.
create or replace function auth_org_ids_for_roles(roles app_role[])
returns setof uuid language sql stable security definer set search_path = public as $$
  select organization_id from organization_members
  where user_id = auth.uid() and status = 'active' and role = any(roles);
$$;

-- ---------- document_templates ----------
create table if not exists document_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title           text not null,
  kind            document_kind not null default 'waiver',
  body            text,                          -- inline template text (optional)
  storage_path    text,                          -- or a path to a template file
  version         integer not null default 1,
  active          boolean not null default true,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_doc_templates_org on document_templates(organization_id);
drop trigger if exists trg_doc_templates_updated on document_templates;
create trigger trg_doc_templates_updated before update on document_templates
  for each row execute function set_updated_at();

-- ---------- member_documents (an assigned/signed document for a member) ----------
create table if not exists member_documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  template_id     uuid references document_templates(id) on delete set null,
  kind            document_kind not null default 'waiver',
  status          document_status not null default 'pending',
  signature       jsonb,                         -- typed name / signature metadata
  file_path       text,                          -- storage path of the signed file
  signed_at       timestamptz,
  expires_at      timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_member_docs_org    on member_documents(organization_id);
create index if not exists idx_member_docs_member on member_documents(member_id);
create index if not exists idx_member_docs_status on member_documents(organization_id, status);
drop trigger if exists trg_member_docs_updated on member_documents;
create trigger trg_member_docs_updated before update on member_documents
  for each row execute function set_updated_at();

-- ---------- Append-only event on sign / decline (§3.1) ----------
create or replace function member_documents_emit_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and new.status in ('signed','declined') then
    insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
    values (new.organization_id, auth.uid(), 'document.' || new.status, 'member_document', new.id,
            jsonb_build_object('member_id', new.member_id, 'kind', new.kind));
  end if;
  return new;
end$$;
drop trigger if exists trg_member_docs_emit on member_documents;
create trigger trg_member_docs_emit after update on member_documents
  for each row execute function member_documents_emit_events();

-- ---------- RLS (tenant read; staff write) ----------
do $$
declare t text;
begin
  foreach t in array array['document_templates','member_documents']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format(
      'create policy %I on %I for select using (organization_id in (select auth_org_ids()))',
      t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format(
      'create policy %I on %I for all '
      || 'using (auth_has_org_role(organization_id, array[''owner'',''admin'',''manager'',''front_desk'']::app_role[])) '
      || 'with check (auth_has_org_role(organization_id, array[''owner'',''admin'',''manager'',''front_desk'']::app_role[]))',
      t || '_write', t);
  end loop;
end$$;

-- ============================================================================
-- ⚠ STORAGE (higher-uncertainty; validate manually after applying)
-- Private bucket; object path convention: {organization_id}/{member_id}/{file}.
-- Read = any active member of the org; write/delete = staff roles.
-- ============================================================================
insert into storage.buckets (id, name, public)
  values ('member-documents', 'member-documents', false)
  on conflict (id) do nothing;

drop policy if exists member_docs_storage_read on storage.objects;
create policy member_docs_storage_read on storage.objects for select to authenticated
  using (
    bucket_id = 'member-documents'
    and (storage.foldername(name))[1] in (select x::text from auth_org_ids() as x)
  );

drop policy if exists member_docs_storage_write on storage.objects;
create policy member_docs_storage_write on storage.objects for all to authenticated
  using (
    bucket_id = 'member-documents'
    and (storage.foldername(name))[1] in (
      select x::text from auth_org_ids_for_roles(
        array['owner','admin','manager','front_desk']::app_role[]) as x)
  )
  with check (
    bucket_id = 'member-documents'
    and (storage.foldername(name))[1] in (
      select x::text from auth_org_ids_for_roles(
        array['owner','admin','manager','front_desk']::app_role[]) as x)
  );

-- End of 0004_documents.sql
