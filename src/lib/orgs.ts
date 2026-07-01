import type { SupabaseClient } from "@supabase/supabase-js";

// Role sets that may WRITE each resource — mirrors the RLS write policies.
export const MEMBER_WRITE_ROLES = ["owner", "admin", "manager", "front_desk"];
export const LOCATION_WRITE_ROLES = ["owner", "admin", "manager"];

// Returns the orgs where the current user holds one of `roles`. Used to populate
// org pickers in create forms. RLS still enforces the boundary server-side; this
// is only so the UI doesn't offer orgs the user cannot write to.
export async function getWritableOrgs(
  supabase: SupabaseClient,
  roles: string[] = MEMBER_WRITE_ROLES,
): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase
    .from("organization_members")
    .select("role, organization:organizations(id, name)");
  type Row = { role: string; organization: { id: string; name: string } | null };
  return ((data ?? []) as unknown as Row[])
    .filter((o) => roles.includes(o.role) && o.organization)
    .map((o) => ({ id: o.organization!.id, name: o.organization!.name }));
}
