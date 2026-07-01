// Member lifecycle statuses — mirrors the member_status enum in migration 0002.
// Kept in a plain module (not a "use server" file, which may only export async fns).
export const MEMBER_STATUSES = [
  "pending",
  "active",
  "frozen",
  "inactive",
  "cancelled",
  "expired",
] as const;

export type MemberStatus = (typeof MEMBER_STATUSES)[number];
