-- ============================================================================
-- LUDUZO — Phase 5: Marketing & Community. Builds on 0001, 0002, 0015, 0019.
--
-- Governed by: CLAUDE.md §1.5.1 layer 1 · §3.1 (events) · A5 (RLS) · A12.
--
-- Adds:
--   community_posts + community_comments — in-app community feed / forum (staff post;
--     members + staff read; members + staff comment).
--   reviews       — member ratings (1-5) + comment.
--   nps_responses — NPS survey score (0-10) + comment.
--   (Social sharing = client-side share links, no schema.)
--
-- STATUS: applied + verified live by the agent on run. A12: all objects guarded.
-- ============================================================================

create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  title text,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_community_posts_org on community_posts(organization_id, created_at desc);

create table if not exists community_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  post_id uuid not null references community_posts(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  author_member_id uuid references members(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_community_comments_post on community_comments(post_id, created_at);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists idx_reviews_org on reviews(organization_id, created_at desc);

create table if not exists nps_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  score integer not null check (score between 0 and 10),
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists idx_nps_org on nps_responses(organization_id, created_at desc);

-- ---------- RLS (A5) ----------
alter table community_posts enable row level security;
alter table community_comments enable row level security;
alter table reviews enable row level security;
alter table nps_responses enable row level security;

-- Community: staff + members (portal) read; staff write posts.
drop policy if exists community_posts_select on community_posts;
create policy community_posts_select on community_posts for select
  using (organization_id in (select auth_org_ids()) or organization_id in (select auth_member_org_ids()));
drop policy if exists community_posts_write on community_posts;
create policy community_posts_write on community_posts for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]));

-- Comments: staff + members read; staff write, OR a member may add their own comment.
drop policy if exists community_comments_select on community_comments;
create policy community_comments_select on community_comments for select
  using (organization_id in (select auth_org_ids()) or organization_id in (select auth_member_org_ids()));
drop policy if exists community_comments_staff_write on community_comments;
create policy community_comments_staff_write on community_comments for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]));
drop policy if exists community_comments_member_insert on community_comments;
create policy community_comments_member_insert on community_comments for insert
  with check (author_member_id in (select auth_member_ids()));

-- Reviews / NPS: staff see all in their org; a member may submit + read their own.
drop policy if exists reviews_select on reviews;
create policy reviews_select on reviews for select
  using (organization_id in (select auth_org_ids()) or member_id in (select auth_member_ids()));
drop policy if exists reviews_staff_write on reviews;
create policy reviews_staff_write on reviews for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]));
drop policy if exists reviews_member_insert on reviews;
create policy reviews_member_insert on reviews for insert
  with check (member_id in (select auth_member_ids()));

drop policy if exists nps_select on nps_responses;
create policy nps_select on nps_responses for select
  using (organization_id in (select auth_org_ids()) or member_id in (select auth_member_ids()));
drop policy if exists nps_staff_write on nps_responses;
create policy nps_staff_write on nps_responses for all
  using (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]))
  with check (auth_has_org_role(organization_id, array['owner','admin','manager','front_desk']::app_role[]));
drop policy if exists nps_member_insert on nps_responses;
create policy nps_member_insert on nps_responses for insert
  with check (member_id in (select auth_member_ids()));

-- End of 0028_community.sql
