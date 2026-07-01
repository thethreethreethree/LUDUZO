import Link from "next/link";
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

  const [{ count: memberCount }, { count: occupancy }, recentEvents] = await Promise.all([
    supabase.from("members").select("id", { count: "exact", head: true }),
    supabase.from("checkins").select("id", { count: "exact", head: true }).is("checked_out_at", null),
    supabase
      .from("events")
      .select("id, event_type, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(6),
  ]);
  const events = (recentEvents.data ?? []) as { id: number; event_type: string; occurred_at: string }[];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500">{user.email}</p>
        </div>
        <form action={signout}>
          <button className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold">
            Sign out
          </button>
        </form>
      </header>

      {memberships.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-gold p-4 text-black">
            <div className="text-xs font-medium opacity-70">Members</div>
            <div className="mt-1 font-display text-2xl font-extrabold tracking-tight">{memberCount ?? 0}</div>
          </div>
          <div className="rounded-md border border-onyx bg-onyx p-4">
            <div className="text-xs text-ash">In the gym now</div>
            <div className="mt-1 font-display text-2xl font-extrabold tracking-tight">{occupancy ?? 0}</div>
          </div>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-500">Your gyms</h2>

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            Could not load memberships: {error.message}
          </p>
        ) : memberships.length === 0 ? (
          <div className="rounded-md border border-onyx bg-onyx p-6 text-center">
            <p className="text-sm text-zinc-400">
              You&apos;re not part of a gym yet.
            </p>
            <div className="mt-3 flex items-center justify-center gap-3">
              <Link
                href="/onboarding"
                className="inline-block rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90"
              >
                Create your gym
              </Link>
              <Link
                href="/portal"
                className="inline-block rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold"
              >
                I&apos;m a member →
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {memberships.map((m, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-md border border-onyx bg-onyx px-4 py-3"
                >
                  <span className="font-medium">
                    {m.organization?.name ?? "(unknown gym)"}
                  </span>
                  <span className="text-xs text-gold">
                    {m.role} · {m.status}
                  </span>
                </li>
              ))}
            </ul>
            <nav className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { href: "/dashboard/members", label: "Members" },
                { href: "/dashboard/programs", label: "Programs" },
                { href: "/dashboard/gamification", label: "Gamification" },
                { href: "/dashboard/retention", label: "Retention" },
                { href: "/dashboard/locations", label: "Locations" },
                { href: "/dashboard/groups", label: "Groups" },
                { href: "/dashboard/guest-passes", label: "Guest passes" },
                { href: "/dashboard/referrals", label: "Referrals" },
                { href: "/dashboard/documents", label: "Documents" },
                { href: "/dashboard/plans", label: "Plans" },
                { href: "/dashboard/coupons", label: "Coupons" },
                { href: "/dashboard/gift-cards", label: "Gift cards" },
                { href: "/dashboard/leads", label: "Leads / CRM" },
                { href: "/dashboard/invoices", label: "Invoices" },
                { href: "/dashboard/checkins", label: "Check-ins" },
                { href: "/dashboard/kiosk", label: "Kiosk" },
                { href: "/dashboard/classes", label: "Classes" },
                { href: "/dashboard/appointments", label: "Appointments" },
                { href: "/dashboard/resources", label: "Resources" },
                { href: "/dashboard/staff", label: "Team" },
                { href: "/dashboard/shifts", label: "Shifts" },
                { href: "/dashboard/tasks", label: "Tasks" },
                { href: "/dashboard/messages", label: "Messages" },
                { href: "/dashboard/certifications", label: "Certifications" },
                { href: "/dashboard/payroll", label: "Payroll" },
                { href: "/dashboard/timeclock", label: "Time clock" },
                { href: "/dashboard/activity", label: "Activity" },
                { href: "/dashboard/reports", label: "Reports" },
                { href: "/dashboard/analytics", label: "Analytics" },
                { href: "/dashboard/inventory", label: "Inventory" },
                { href: "/dashboard/maintenance", label: "Maintenance" },
                { href: "/dashboard/lockers", label: "Lockers" },
                { href: "/dashboard/pos", label: "Point of sale" },
                { href: "/dashboard/announcements", label: "Announcements" },
                { href: "/dashboard/community", label: "Community" },
                { href: "/dashboard/feedback", label: "Reviews / NPS" },
                { href: "/dashboard/settings", label: "Settings" },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-md border border-onyx bg-onyx px-4 py-3 text-sm font-medium hover:border-gold hover:text-gold"
                >
                  {l.label} →
                </Link>
              ))}
            </nav>
          </>
        )}
      </section>

      {memberships.length > 0 && events.length > 0 ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-500">Recent activity</h2>
            <Link href="/dashboard/activity" className="text-xs text-gold hover:underline">
              View all →
            </Link>
          </div>
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between border-l-2 border-gold px-4 py-2 text-sm">
                <span className="font-mono text-xs">{e.event_type}</span>
                <span className="text-xs text-zinc-500">
                  {new Date(e.occurred_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
