-- ============================================================================
-- LUDUZO — Audit remediation for the Phase 1-9 build (AUDIT of migrations 0024-0030).
--
-- F2 (§3.2, A5): bind organization_id to the member's own org in the three
--   member-insert policies, so a crafted cross-org insert is rejected by RLS.
-- F1 (§3.1, §3.6): emit append-only lifecycle events for the high-value new
--   tables (money / security / consent / feedback) that previously emitted none.
--
-- A12: idempotent (create-or-replace + drop-if-exists).
-- ============================================================================

-- ---------- F2: org-bound member-insert policies ----------
drop policy if exists reviews_member_insert on reviews;
create policy reviews_member_insert on reviews for insert
  with check (member_id in (select auth_member_ids())
              and organization_id in (select auth_member_org_ids()));

drop policy if exists nps_member_insert on nps_responses;
create policy nps_member_insert on nps_responses for insert
  with check (member_id in (select auth_member_ids())
              and organization_id in (select auth_member_org_ids()));

drop policy if exists community_comments_member_insert on community_comments;
create policy community_comments_member_insert on community_comments for insert
  with check (author_member_id in (select auth_member_ids())
              and organization_id in (select auth_member_org_ids()));

-- ---------- F1: lifecycle events for high-value new tables ----------
create or replace function gift_cards_emit_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
  values (new.organization_id, auth.uid(), 'gift_card.issued', 'gift_card', new.id,
          jsonb_build_object('code', new.code, 'initial_cents', new.initial_cents));
  return new;
end $$;
drop trigger if exists trg_gift_cards_emit on gift_cards;
create trigger trg_gift_cards_emit after insert on gift_cards for each row execute function gift_cards_emit_events();

create or replace function refunds_emit_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
  values (new.organization_id, auth.uid(), 'refund.recorded', 'refund', new.id,
          jsonb_build_object('amount_cents', new.amount_cents, 'invoice_id', new.invoice_id));
  return new;
end $$;
drop trigger if exists trg_refunds_emit on refunds;
create trigger trg_refunds_emit after insert on refunds for each row execute function refunds_emit_events();

create or replace function locker_rentals_emit_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
  values (new.organization_id, auth.uid(), 'locker.rented', 'locker_rental', new.id,
          jsonb_build_object('locker_label', new.locker_label, 'member_id', new.member_id));
  return new;
end $$;
drop trigger if exists trg_locker_rentals_emit on locker_rentals;
create trigger trg_locker_rentals_emit after insert on locker_rentals for each row execute function locker_rentals_emit_events();

create or replace function member_badges_emit_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
  values (new.organization_id, auth.uid(), 'badge.awarded', 'member', new.member_id,
          jsonb_build_object('badge_id', new.badge_id));
  return new;
end $$;
drop trigger if exists trg_member_badges_emit on member_badges;
create trigger trg_member_badges_emit after insert on member_badges for each row execute function member_badges_emit_events();

create or replace function consent_records_emit_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
  values (new.organization_id, auth.uid(), 'consent.recorded', 'member', new.member_id,
          jsonb_build_object('consent_type', new.consent_type, 'granted', new.granted));
  return new;
end $$;
drop trigger if exists trg_consent_records_emit on consent_records;
create trigger trg_consent_records_emit after insert on consent_records for each row execute function consent_records_emit_events();

create or replace function api_keys_emit_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
  values (new.organization_id, auth.uid(), 'api_key.created', 'api_key', new.id,
          jsonb_build_object('name', new.name, 'key_prefix', new.key_prefix));
  return new;
end $$;
drop trigger if exists trg_api_keys_emit on api_keys;
create trigger trg_api_keys_emit after insert on api_keys for each row execute function api_keys_emit_events();

create or replace function reviews_emit_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
  values (new.organization_id, auth.uid(), 'review.submitted', 'review', new.id,
          jsonb_build_object('rating', new.rating, 'member_id', new.member_id));
  return new;
end $$;
drop trigger if exists trg_reviews_emit on reviews;
create trigger trg_reviews_emit after insert on reviews for each row execute function reviews_emit_events();

create or replace function nps_emit_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
  values (new.organization_id, auth.uid(), 'nps.submitted', 'nps_response', new.id,
          jsonb_build_object('score', new.score, 'member_id', new.member_id));
  return new;
end $$;
drop trigger if exists trg_nps_emit on nps_responses;
create trigger trg_nps_emit after insert on nps_responses for each row execute function nps_emit_events();

-- End of 0031_audit_remediation.sql
