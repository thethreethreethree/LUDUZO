// Postgres error-code (SQLSTATE) helpers, shared across server actions.
//
// Supabase surfaces DB errors as PostgrestError with a `.code` that is the raw Postgres
// SQLSTATE. When a DB constraint or trigger stops a write, the default `.message` is the
// raw Postgres text (e.g. `duplicate key value violates unique constraint "…"`), which is
// not something to show a front-desk user. These helpers let actions detect the common
// classes and substitute a human message. Full list: https://www.postgresql.org/docs/current/errcodes-appendix.html

/** unique_violation — a UNIQUE constraint or unique index rejected the row. */
export const PG_UNIQUE_VIOLATION = "23505";
/** check_violation — a CHECK constraint or a `raise … using errcode='check_violation'`. */
export const PG_CHECK_VIOLATION = "23514";
/** foreign_key_violation — a referenced row is missing or a referencing row still exists. */
export const PG_FOREIGN_KEY_VIOLATION = "23503";

export function isUniqueViolation(error: { code?: string | null } | null): boolean {
  return error?.code === PG_UNIQUE_VIOLATION;
}

export function isCheckViolation(error: { code?: string | null } | null): boolean {
  return error?.code === PG_CHECK_VIOLATION;
}
