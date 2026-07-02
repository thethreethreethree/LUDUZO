-- ============================================================================
-- LUDUZO — More in-app notification types: document-to-sign + new invoice (§10).
--
-- Governed by: §3.6 (make change visible) · §3.1 (events) · §3.2 · A12.
-- Builds on the applied 0043 notifications inbox. Emits a member notification when
-- a document is assigned to them (status pending) or an invoice is raised against
-- them. SECURITY DEFINER so the insert bypasses the member's RLS. No UI change —
-- the /more inbox already renders any notification kind.
--
-- ⚠ STATUS: authored while the direct-Postgres host was unreachable — UNAPPLIED.
-- Apply via the Supabase SQL editor. A12: create-or-replace / drop-guarded.
-- ============================================================================

create or replace function member_documents_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.member_id is not null and new.status = 'pending' then
    insert into notifications (organization_id, member_id, kind, title, body, link)
    values (new.organization_id, new.member_id, 'document_assigned',
            'A document needs your signature',
            'Your ' || new.kind::text || ' is ready to sign.', '/portal');
  end if;
  return new;
end $$;
drop trigger if exists trg_member_documents_notify on member_documents;
create trigger trg_member_documents_notify after insert on member_documents
  for each row execute function member_documents_notify();

create or replace function invoices_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.member_id is not null and new.status <> 'draft' then
    insert into notifications (organization_id, member_id, kind, title, body, link)
    values (new.organization_id, new.member_id, 'invoice_created',
            'New invoice',
            'An invoice for ' || to_char(new.amount_cents / 100.0, 'FM999990.00') || ' ' || upper(new.currency)
              || coalesce(' is due ' || to_char(new.due_date, 'Mon DD'), '') || '.',
            '/portal/more');
  end if;
  return new;
end $$;
drop trigger if exists trg_invoices_notify on invoices;
create trigger trg_invoices_notify after insert on invoices
  for each row execute function invoices_notify();

-- End of 0051_more_notifications.sql
