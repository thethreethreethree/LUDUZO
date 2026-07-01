// Shared check-in helpers.
//
// The partial unique index `uq_checkins_open_member` (migration 0018) is the race-proof
// invariant: a member has at most one OPEN check-in. The app-level "already checked in?"
// read-then-insert guard in the check-in actions handles the common case with a friendly
// message, but two check-ins racing past that guard both pass the read and only the DB
// index stops the second insert — surfacing Postgres SQLSTATE 23505 (unique_violation).
//
// Without translation the front-desk user would see the raw
//   `duplicate key value violates unique constraint "uq_checkins_open_member"`
// instead of a human message. checkins has no other unique constraint that an INSERT can
// trip (its PK is a random uuid), so a unique_violation on a checkins insert unambiguously
// means "this member is already checked in."

import { isUniqueViolation } from "@/lib/pg-errors";

/** True when a checkins INSERT failed because the member already has an open check-in. */
export function isOpenCheckinConflict(error: { code?: string | null } | null): boolean {
  return isUniqueViolation(error);
}

/**
 * Friendly message for a failed checkins INSERT: the conflict message on a race, else the
 * raw error. `conflictMessage` lets each surface keep its own voice (staff pages say
 * "Member is already checked in."; the self-service kiosk says "You're already checked in.").
 */
export function checkinErrorMessage(
  error: { code?: string | null; message: string } | null,
  conflictMessage = "Member is already checked in.",
): string {
  if (!error) return "";
  return isOpenCheckinConflict(error) ? conflictMessage : error.message;
}
