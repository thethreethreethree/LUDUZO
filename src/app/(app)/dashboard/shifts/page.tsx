import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { createShift, deleteShift } from "./actions";

export const dynamic = "force-dynamic";

type Shift = {
  id: string;
  starts_at: string;
  ends_at: string;
  role_label: string | null;
  staff: { full_name: string | null } | null;
};
type StaffOpt = { user_id: string; profile: { full_name: string | null } | null };

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgs = await getWritableOrgs(supabase);

  const { data: shiftData } = await supabase
    .from("staff_shifts")
    .select("id, starts_at, ends_at, role_label, staff:profiles(full_name)")
    .gte("ends_at", new Date(new Date().getTime() - 7 * 24 * 3600 * 1000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(100);
  const shifts = (shiftData ?? []) as unknown as Shift[];

  const { data: staffData } = await supabase
    .from("organization_members")
    .select("user_id, profile:profiles(full_name)")
    .limit(200);
  const staff = (staffData ?? []) as unknown as StaffOpt[];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">← Dashboard</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Shift schedule</h1>
        <p className="text-sm text-zinc-500">Roster your team across the week.</p>
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
      ) : null}

      {orgs.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-zinc-500">You don&apos;t manage any gym.</p>
      ) : (
        <form action={createShift} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-5">
          <OrgPicker orgs={orgs} />
          <div className="flex gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-zinc-500">Staff
              <select name="staff_id" required className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                <option value="">Select…</option>
                {staff.map((s) => (<option key={s.user_id} value={s.user_id}>{s.profile?.full_name ?? "(staff)"}</option>))}
              </select>
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-zinc-500">Role
              <input name="role_label" placeholder="e.g. Front desk" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
            </label>
          </div>
          <div className="flex gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-zinc-500">Starts
              <input name="starts_at" type="datetime-local" required className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-zinc-500">Ends
              <input name="ends_at" type="datetime-local" required className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
            </label>
          </div>
          <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Add shift</button>
        </form>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-zinc-500">Upcoming shifts</h2>
        {shifts.length === 0 ? (
          <p className="text-sm text-zinc-500">No shifts scheduled.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx">
            {shifts.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">{s.staff?.full_name ?? "(staff)"}{s.role_label ? ` · ${s.role_label}` : ""}</span>
                  <span className="text-xs text-zinc-500">
                    {new Date(s.starts_at).toLocaleString()} → {new Date(s.ends_at).toLocaleTimeString()}
                  </span>
                </div>
                <form action={deleteShift}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="rounded-md border border-iron px-2 py-1 text-xs font-medium hover:border-gold hover:text-gold">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
