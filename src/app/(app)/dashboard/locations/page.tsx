import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs, LOCATION_WRITE_ROLES } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { createLocation, updateLocation } from "./actions";

const LOCATION_STATUSES = ["active", "inactive", "suspended", "pending"];

export const dynamic = "force-dynamic";

type LocationRow = {
  id: string;
  name: string;
  timezone: string;
  capacity: number | null;
  status: string;
  organization: { name: string } | null;
};

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("locations")
    .select("id, name, timezone, capacity, status, organization:organizations(name)")
    .order("name", { ascending: true })
    .limit(200);
  const locations = (data ?? []) as unknown as LocationRow[];
  const orgs = await getWritableOrgs(supabase, LOCATION_WRITE_ROLES);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Locations</h1>
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {locations.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-zinc-500 ">
          No locations yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
          {locations.map((l) => (
            <li key={l.id} className="px-4 py-3">
              {orgs.length > 0 ? (
                <form action={updateLocation} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={l.id} />
                  <input name="name" defaultValue={l.name} className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
                  <input name="capacity" type="number" min="0" defaultValue={l.capacity ?? ""} placeholder="Cap" className="w-20 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
                  <select name="status" defaultValue={l.status} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                    {LOCATION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                    Save
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="font-medium">{l.name}</span>
                  <span className="text-xs text-zinc-500">{l.status}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {orgs.length > 0 ? (
        <form action={createLocation} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-4">
          <h2 className="text-sm font-medium">Add location</h2>
          <OrgPicker orgs={orgs} />
          <input name="name" required placeholder="Location name" className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          <div className="flex gap-3">
            <input name="timezone" placeholder="Timezone (e.g. UTC)" className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
            <input name="capacity" type="number" min="0" placeholder="Capacity" className="w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          </div>
          <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
            Add location
          </button>
        </form>
      ) : (
        <p className="text-sm text-zinc-500">
          You need a manager+ role in a gym to add locations.
        </p>
      )}
    </main>
  );
}
