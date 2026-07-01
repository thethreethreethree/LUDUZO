-- ============================================================================
-- LUDUZO — Phase 3: Member Engagement & Retention. Builds on 0001, 0002, 0014.
--
-- Governed by: CLAUDE.md §1.5.1 layer 1 · §3.1 (events) · §3.2 (honest signals) ·
--   §3.4 (no faked intelligence) · A5 (RLS) · A12.
--
-- Adds:
--   workout_plans + workout_exercises   — programme builder.
--   meal_plans + meal_plan_items        — nutrition / meal planning.
--   badges + member_badges              — gamification (awards).
--   challenges + challenge_participants — gamification (challenges/leaderboard).
--   member_progress_photos              — progress photos (Storage-path refs).
--   member_measurements +cols           — InBody-style body metrics.
--   (Streaks/leaderboards + churn/at-risk are DERIVED at query time from checkins —
--    honest heuristics, NOT stored "AI" verdicts, per §3.4.)
--
-- STATUS: applied + verified live by the agent on run. A12: all objects guarded.
-- ============================================================================

-- ---------- workout plans ----------
create table if not exists workout_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  name text not null,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_workout_plans_org on workout_plans(organization_id);
create index if not exists idx_workout_plans_member on workout_plans(member_id);
drop trigger if exists trg_workout_plans_updated on workout_plans;
create trigger trg_workout_plans_updated before update on workout_plans for each row execute function set_updated_at();

create table if not exists workout_exercises (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid not null references workout_plans(id) on delete cascade,
  name text not null,
  sets integer,
  reps integer,
  weight_kg numeric(6,2),
  position integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_workout_exercises_plan on workout_exercises(plan_id, position);

-- ---------- nutrition ----------
create table if not exists meal_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  name text not null,
  notes text,
  daily_calorie_target integer,
  created_at timestamptz not null default now()
);
create index if not exists idx_meal_plans_org on meal_plans(organization_id);

create table if not exists meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  meal_plan_id uuid not null references meal_plans(id) on delete cascade,
  meal text not null default 'meal',
  description text not null,
  calories integer,
  position integer not null default 0
);
create index if not exists idx_meal_plan_items_plan on meal_plan_items(meal_plan_id, position);

-- ---------- gamification: badges ----------
create table if not exists badges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  icon text,
  created_at timestamptz not null default now()
);
create index if not exists idx_badges_org on badges(organization_id);

create table if not exists member_badges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  badge_id uuid not null references badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  unique (member_id, badge_id)
);
create index if not exists idx_member_badges_member on member_badges(member_id);

-- ---------- gamification: challenges ----------
create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  metric text not null default 'checkins', -- checkins | custom
  goal_target integer,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);
create index if not exists idx_challenges_org on challenges(organization_id);

create table if not exists challenge_participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  challenge_id uuid not null references challenges(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  progress integer not null default 0,
  joined_at timestamptz not null default now(),
  unique (challenge_id, member_id)
);
create index if not exists idx_challenge_participants_ch on challenge_participants(challenge_id);

-- ---------- progress photos ----------
create table if not exists member_progress_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  storage_path text not null,
  taken_on date,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_member_progress_photos_member on member_progress_photos(member_id);

-- ---------- InBody-style body metrics on the existing measurements table ----------
alter table member_measurements add column if not exists muscle_mass_kg numeric(6,2);
alter table member_measurements add column if not exists chest_cm numeric(6,2);
alter table member_measurements add column if not exists waist_cm numeric(6,2);
alter table member_measurements add column if not exists hips_cm numeric(6,2);
alter table member_measurements add column if not exists notes text;

-- ---------- RLS (A5): tenant select (+member self-read where member-owned); staff write ----------
do $$
declare t text;
begin
  foreach t in array array[
    'workout_plans','workout_exercises','meal_plans','meal_plan_items',
    'badges','member_badges','challenges','challenge_participants','member_progress_photos'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t||'_select', t);
    execute format('create policy %I on %I for select using (organization_id in (select auth_org_ids()))', t||'_select', t);
    execute format('drop policy if exists %I on %I', t||'_write', t);
    execute format('create policy %I on %I for all using (auth_has_org_role(organization_id, array[''owner'',''admin'',''manager'',''front_desk'']::app_role[])) with check (auth_has_org_role(organization_id, array[''owner'',''admin'',''manager'',''front_desk'']::app_role[]))', t||'_write', t);
  end loop;
end $$;

-- Member self-read for their own workout / meal / badges / photos (member portal).
drop policy if exists workout_plans_member_read on workout_plans;
create policy workout_plans_member_read on workout_plans for select using (member_id in (select auth_member_ids()));
drop policy if exists meal_plans_member_read on meal_plans;
create policy meal_plans_member_read on meal_plans for select using (member_id in (select auth_member_ids()));
drop policy if exists member_badges_member_read on member_badges;
create policy member_badges_member_read on member_badges for select using (member_id in (select auth_member_ids()));
drop policy if exists member_progress_photos_member_read on member_progress_photos;
create policy member_progress_photos_member_read on member_progress_photos for select using (member_id in (select auth_member_ids()));

-- End of 0026_engagement.sql
