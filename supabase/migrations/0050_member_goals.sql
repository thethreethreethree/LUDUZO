-- ============================================================================
-- LUDUZO — Member self-set goals + fitness level (§1 profile self-setup).
--
-- Governed by: §3.2 · §3.3 (guide, don't overtake) · A12.
-- Adds two member-facing profile columns and a column-restricted RPC so a member
-- can set THEIR OWN goals + fitness level (nothing else). Separate RPC from
-- update_my_profile (0045) to avoid changing that function's signature/callers.
--
-- ⚠ STATUS: authored while the direct-Postgres host was unreachable — UNAPPLIED.
-- Apply via the Supabase SQL editor. The /more goals form maps a missing-column /
-- missing-function error to a friendly message until applied.
-- ============================================================================

alter table members add column if not exists goals text;
alter table members add column if not exists fitness_level text;

create or replace function update_my_goals(p_goals text, p_fitness_level text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_goals text := nullif(trim(coalesce(p_goals, '')), '');
  v_level text := nullif(trim(coalesce(p_fitness_level, '')), '');
begin
  if v_uid is null then
    raise exception 'update_my_goals: not authenticated';
  end if;
  if (v_goals is not null and length(v_goals) > 500) or (v_level is not null and length(v_level) > 40) then
    raise exception 'update_my_goals: value too long';
  end if;

  update members
     set goals = v_goals,
         fitness_level = v_level
   where profile_id = v_uid;
end $$;

grant execute on function update_my_goals(text, text) to authenticated;

-- End of 0050_member_goals.sql
