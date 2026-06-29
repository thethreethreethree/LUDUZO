import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signout } from "./actions";

// Dynamic: reads cookies/session, so it is never statically prerendered.
export const dynamic = "force-dynamic";

type Membership = {
  role: string;
  status: string;
  organization: { name: string; slug: string } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // getUser() re-validates the JWT with the auth server (not just the cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // RLS guarantees this returns ONLY the orgs this user belongs to (verified by
  // supabase/tests/0001_foundation_rls_verify.sql). No org filter is needed here —
  // the database enforces the tenant boundary.
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, status, organization:organizations(name, slug)");

  const memberships = (data ?? []) as unknown as Membership[];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500">{user.email}</p>
        </div>
        <form action={signout}>
          <button className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
            Sign out
          </button>
        </form>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-500">Your gyms</h2>

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            Could not load memberships: {error.message}
          </p>
        ) : memberships.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              You&apos;re not part of a gym yet.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Ask a gym owner to add you, or wait for organization onboarding
              (coming in a later phase).
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {memberships.map((m, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800"
              >
                <span className="font-medium">
                  {m.organization?.name ?? "(unknown gym)"}
                </span>
                <span className="text-xs text-zinc-500">
                  {m.role} · {m.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
