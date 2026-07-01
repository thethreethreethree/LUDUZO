import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { formatMoney } from "@/lib/billing";
import { createResource, bookResource, cancelResourceBooking } from "./actions";
import { RESOURCE_TYPES } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

type Resource = { id: string; name: string; type: string; capacity: number; hourly_rate_cents: number; active: boolean };
type Booking = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  resource: { name: string } | null;
  member: { first_name: string; last_name: string } | null;
};
type MemberOpt = { id: string; first_name: string; last_name: string };

export default async function ResourcesPage({
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

  const orgs = await getWritableOrgs(supabase);

  const { data: resData } = await supabase
    .from("resources")
    .select("id, name, type, capacity, hourly_rate_cents, active")
    .eq("active", true)
    .order("name", { ascending: true });
  const resources = (resData ?? []) as unknown as Resource[];

  const { data: bookData } = await supabase
    .from("resource_bookings")
    .select("id, starts_at, ends_at, status, resource:resources(name), member:members(first_name, last_name)")
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true })
    .limit(50);
  const bookings = (bookData ?? []) as unknown as Booking[];

  const { data: memberData } = await supabase
    .from("members")
    .select("id, first_name, last_name")
    .order("last_name", { ascending: true })
    .limit(500);
  const members = (memberData ?? []) as unknown as MemberOpt[];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-h1 text-bone">Resources</h1>
        <p className="text-sm text-ash">Courts, rooms, lockers and bookable equipment.</p>
      </div>

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>
      ) : null}

      {orgs.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-ash">
          You don&apos;t manage any gym.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <form action={createResource} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-5">
            <span className="text-sm font-medium">Add a resource</span>
            <OrgPicker orgs={orgs} />
            <input name="name" required placeholder="e.g. Court 1 / Locker 12" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            <div className="flex gap-3">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ash">
                Type
                <select name="type" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
                  {RESOURCE_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                </select>
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ash">
                Capacity
                <input name="capacity" type="number" min="1" defaultValue={1} className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ash">
                $/hr
                <input name="hourly_rate" type="number" step="0.01" min="0" placeholder="0" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
              </label>
            </div>
            <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Add</button>
          </form>

          <form action={bookResource} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-5">
            <span className="text-sm font-medium">Book a resource</span>
            <OrgPicker orgs={orgs} />
            <select name="resource_id" required className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
              <option value="">Select resource…</option>
              {resources.map((r) => (<option key={r.id} value={r.id}>{r.name} ({r.type})</option>))}
            </select>
            <select name="member_id" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
              <option value="">— no member —</option>
              {members.map((m) => (<option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>))}
            </select>
            <div className="flex gap-3">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ash">
                Starts
                <input name="starts_at" type="datetime-local" required className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ash">
                Ends
                <input name="ends_at" type="datetime-local" required className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
              </label>
            </div>
            <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Book</button>
          </form>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Resources ({resources.length})</h2>
        {resources.length === 0 ? (
          <p className="text-sm text-ash">No resources yet.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {resources.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-md border border-onyx bg-onyx px-4 py-3 text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="text-xs text-ash">
                  {r.type} · cap {r.capacity}{r.hourly_rate_cents ? ` · ${formatMoney(r.hourly_rate_cents)}/hr` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Upcoming bookings</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-ash">No bookings.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">{b.resource?.name ?? "(resource)"}</span>
                  <span className="text-xs text-ash">
                    {new Date(b.starts_at).toLocaleString()} → {new Date(b.ends_at).toLocaleTimeString()}
                    {b.member ? ` · ${b.member.first_name} ${b.member.last_name}` : ""}
                  </span>
                </div>
                <form action={cancelResourceBooking}>
                  <input type="hidden" name="id" value={b.id} />
                  <button className="rounded-md border border-iron px-2 py-1 text-xs font-medium hover:border-gold hover:text-gold">
                    Cancel
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
