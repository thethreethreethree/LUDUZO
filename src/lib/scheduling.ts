// Shared scheduling constants. Kept out of the "use server" action files, which may
// only export async functions.

export const APPOINTMENT_STATUSES = ["scheduled", "completed", "cancelled", "no_show"] as const;
export const RESOURCE_TYPES = ["court", "room", "locker", "equipment", "other"] as const;
