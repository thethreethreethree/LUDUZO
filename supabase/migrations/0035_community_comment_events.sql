-- ============================================================================
-- LUDUZO — Emit append-only events for community_comments (F5 audit remediation).
--
-- Governed by: §3.1 (everything is an event; append-only), §3.6 (make learning
-- visible — member engagement in the community feed is a signal). A12: guarded.
--
-- WHY: 0031 added emit triggers for the money/security/consent/feedback tables but
-- NOT for community_comments, even though members writing comments is exactly the
-- kind of engagement signal the System should be able to replay. The audit flagged
-- this gap (F5) as inconsistent with §3.1 — member-authored writes that leave no
-- event trace can't feed retrospective analysis. This closes it.
-- ============================================================================

create or replace function community_comments_emit_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
  values (new.organization_id, auth.uid(), 'community_comment.posted', 'community_comment', new.id,
          jsonb_build_object('post_id', new.post_id, 'author_member_id', new.author_member_id));
  return new;
end $$;

drop trigger if exists trg_community_comments_emit on community_comments;
create trigger trg_community_comments_emit after insert on community_comments
  for each row execute function community_comments_emit_events();

-- End of 0035_community_comment_events.sql
