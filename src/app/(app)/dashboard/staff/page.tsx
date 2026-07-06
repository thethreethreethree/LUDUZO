import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { addStaff, removeStaff, updateStaffRole } from "./actions";

export const dynamic = "force-dynamic";

const STAFF_ROLES = ["admin", "manager", "trainer", "front_desk", "member"];
const ADMIN_ROLES = ["owner", "admin"];

type StaffRow = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  user: { full_name: string | null; email: string | null } | null;
  organization: { name: string } | null;
};

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error: formError, ok } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminOrgs = await getWritableOrgs(supabase, ADMIN_ROLES);

  // RLS (orgmem_select) scopes this to the caller's orgs.
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, user_id, role, status, user:profiles(full_name, email), organization:organizations(name)")
    .order("role", { ascending: true })
    .limit(500);
  const staff = (data ?? []) as unknown as StaffRow[];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-h1 text-bone">Team</h1>
        <p className="text-sm text-ash">Everyone with a role in your gym.</p>
      </div>

      {formError ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
          {formError}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-win dark:bg-green-950 dark:text-green-300">
          Staff updated.
        </p>
      ) : null}

      {adminOrgs.length > 0 ? (
        <form action={addStaff} className="flex flex-wrap items-end gap-2 rounded-md border border-onyx bg-onyx p-4">
          <h2 className="w-full text-sm font-medium">Add staff (existing account)</h2>
          <OrgPicker orgs={adminOrgs} />
          <input name="email" aria-label="Staff email" type="email" required placeholder="their@email.com" className="flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <select name="role" aria-label="Staff role" defaultValue="front_desk" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
            Add
          </button>
          <p className="w-full text-xs text-ash">
            The person must already have a LUDUZO account. Email-invite for new sign-ups is coming.
          </p>
        </form>
      ) : null}

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
          Could not load team: {error.message}
        </p>
      ) : staff.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-ash ">
          No team members.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-4 py-3">
              <span className="flex flex-col">
                <span className="font-medium">{s.user?.full_name ?? s.user?.email ?? "(user)"}</span>
                <span className="text-xs text-ash">
                  {s.organization?.name ? `${s.organization.name} · ` : ""}
                  {s.status}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {adminOrgs.length > 0 && s.user_id !== user.id ? (
                  <>
                    <form action={updateStaffRole} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="user_id" value={s.user_id} />
                      <select name="role" aria-label="Change this staff member's role" defaultValue={s.role} className="rounded-md border border-iron px-2 py-1 text-xs bg-onyx-2">
                        {STAFF_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <button className="rounded-md border border-iron px-2 py-1 text-xs font-medium hover:bg-onyx-2 hover:bg-onyx-2">
                        Save
                      </button>
                    </form>
                    <form action={removeStaff}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="user_id" value={s.user_id} />
                      <button className="text-xs text-red-600 hover:underline dark:text-red-400">Remove</button>
                    </form>
                  </>
                ) : (
                  <span className="text-xs text-ash">{s.role}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
