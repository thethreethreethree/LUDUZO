-- ============================================================================
-- LUDUZO — Class type + difficulty (§4 filters completion).
--
-- Governed by: §3.2 (members already read classes via 0034) · §1.5.1 L3 · A12.
-- Two free-text tags on classes so staff can categorise (e.g. type "Yoga",
-- difficulty "Beginner") and members can filter the schedule by them. Members
-- read them through the existing classes_select_member policy; staff set them via
-- classes_write.
--
-- ⚠ STATUS: authored while the direct-Postgres host was unreachable — UNAPPLIED.
-- Apply via the Supabase SQL editor. The book page fetches these in a SEPARATE
-- query, so a missing column can't break the main schedule — the type/difficulty
-- filter chips simply don't appear until applied.
-- ============================================================================

alter table classes add column if not exists class_type text;
alter table classes add column if not exists difficulty text;

-- End of 0056_class_type_difficulty.sql
