import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type EventRow = {
  id: number;
  event_type: string;
  subject_type: string | null;
  occurred_at: string;
  organization: { name: string } | null;
};

export default async function ActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The append-only event stream (§3.1), RLS-scoped to the caller's orgs.
  const { data, error } = await supabase
    .from("events")
    .select("id, event_type, subject_type, occurred_at, organization:organizations(name)")
    .order("occurred_at", { ascending: false })
    .limit(100);
  const events = (data ?? []) as unknown as EventRow[];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-zinc-500">
          The immutable record of what happened across your gym.
        </p>
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Could not load activity: {error.message}
        </p>
      ) : events.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-zinc-500 ">
          No activity yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between border-l-2 border-gold px-4 py-2.5">
              <span className="flex flex-col">
                <span className="font-mono text-xs">{e.event_type}</span>
                <span className="text-xs text-zinc-500">
                  {e.organization?.name ? `${e.organization.name}` : ""}
                  {e.subject_type ? ` · ${e.subject_type}` : ""}
                </span>
              </span>
              <span className="text-xs text-zinc-500">
                {new Date(e.occurred_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
