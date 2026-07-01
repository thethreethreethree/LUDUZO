import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clockIn, clockOut } from "./actions";

export const dynamic = "force-dynamic";

type OrgRow = { organization: { id: string; name: string } | null };
type Entry = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  organization: { name: string } | null;
};

export default async function TimeclockPage({
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

  const { data: orgData } = await supabase
    .from("organization_members")
    .select("organization:organizations(id, name)");
  const orgs = ((orgData ?? []) as unknown as OrgRow[])
    .map((r) => r.organization)
    .filter((o): o is { id: string; name: string } => !!o);

  const { data: entryData } = await supabase
    .from("time_entries")
    .select("id, clock_in, clock_out, organization:organizations(name)")
    .eq("staff_user_id", user.id)
    .order("clock_in", { ascending: false })
    .limit(50);
  const entries = (entryData ?? []) as unknown as Entry[];
  const open = entries.find((e) => !e.clock_out);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-h1 text-bone">Time clock</h1>
      </div>

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
          {error}
        </p>
      ) : null}

      {open ? (
        <div className="flex items-center justify-between rounded-md border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
          <span className="text-sm">
            Clocked in{open.organization?.name ? ` at ${open.organization.name}` : ""} since{" "}
            {new Date(open.clock_in).toLocaleTimeString()}
          </span>
          <form action={clockOut}>
            <input type="hidden" name="id" value={open.id} />
            <button className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
              Clock out
            </button>
          </form>
        </div>
      ) : orgs.length > 0 ? (
        <form action={clockIn} className="flex items-end gap-2 rounded-md border border-onyx bg-onyx p-4">
          {orgs.length === 1 ? (
            <input type="hidden" name="organization_id" value={orgs[0].id} />
          ) : (
            <select name="organization_id" required className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <button className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
            Clock in
          </button>
        </form>
      ) : (
        <p className="text-sm text-ash">You&apos;re not a member of any gym.</p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Recent</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-ash">No time entries yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>{new Date(e.clock_in).toLocaleString()}</span>
                <span className="text-xs text-ash">
                  {e.clock_out ? `→ ${new Date(e.clock_out).toLocaleTimeString()}` : "open"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
