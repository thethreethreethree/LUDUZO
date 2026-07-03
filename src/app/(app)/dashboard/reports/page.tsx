import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/billing";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [membersC, activeC, occupancyC, upcomingC, subsC, paidInv, memberStatuses, openInv, revSummary] = await Promise.all([
    supabase.from("members").select("id", { count: "exact", head: true }),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("checkins").select("id", { count: "exact", head: true }).is("checked_out_at", null),
    supabase
      .from("class_sessions")
      .select("id", { count: "exact", head: true })
      .gte("starts_at", new Date().toISOString()),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
    // Ordered desc so the retained 5k (if a gym exceeds it) are the RECENT paid
    // invoices the by-month chart + today's-revenue actually plot — not an arbitrary
    // subset. (The headline totals now come from gym_revenue_summary, below — these
    // rows are only for the recent-window chart + today.)
    supabase.from("invoices").select("amount_cents, paid_at").eq("status", "paid").order("paid_at", { ascending: false, nullsFirst: false }).limit(5000),
    supabase.from("members").select("status").limit(5000),
    // 'open' is the only unpaid invoice_status ('past_due' is a SUBSCRIPTION status,
    // not an invoice one — see 0033; querying it here errored the whole query, so
    // Outstanding silently read $0 for every gym with real open invoices). Kept as the
    // graceful fallback if the aggregate view (0059) isn't applied.
    supabase.from("invoices").select("amount_cents").eq("status", "open").limit(5000),
    // 0059: TRUE lifetime paid + outstanding (server-side SUM, org-scoped). Falls back
    // to the capped row sums below if the view is absent.
    supabase.from("gym_revenue_summary").select("paid_cents, outstanding_cents"),
  ]);

  const outstandingCentsCapped = ((openInv.data ?? []) as { amount_cents: number }[]).reduce(
    (sum, r) => sum + (r.amount_cents ?? 0),
    0,
  );

  const weekAhead = new Date();
  weekAhead.setDate(weekAhead.getDate() + 7);
  const { count: renewingSoon } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .gte("current_period_end", new Date().toISOString())
    .lte("current_period_end", weekAhead.toISOString());

  const statusCounts = new Map<string, number>();
  for (const m of (memberStatuses.data ?? []) as { status: string }[]) {
    statusCounts.set(m.status, (statusCounts.get(m.status) ?? 0) + 1);
  }
  const statusRows = [...statusCounts.entries()].sort((a, b) => b[1] - a[1]);

  // Check-ins per day over the last 7 days.
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  weekAgo.setHours(0, 0, 0, 0);
  const { data: recentCheckins } = await supabase
    .from("checkins")
    .select("checked_in_at")
    .gte("checked_in_at", weekAgo.toISOString())
    .limit(10000);
  const perDay = new Map<string, number>();
  for (const c of (recentCheckins ?? []) as { checked_in_at: string }[]) {
    const day = c.checked_in_at.slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const days: { day: string; count: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    days.push({ day: key, count: perDay.get(key) ?? 0 });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  const paidRows = (paidInv.data ?? []) as { amount_cents: number; paid_at: string | null }[];
  const revenueCentsCapped = paidRows.reduce((sum, r) => sum + (r.amount_cents ?? 0), 0);

  // Headline lifetime totals from the 0059 aggregate view (TRUE sums). If the view
  // isn't applied (error), fall back to the capped row sums so the page still renders.
  const revView = revSummary.error ? null : ((revSummary.data ?? []) as { paid_cents: number | string; outstanding_cents: number | string }[]);
  const revenueCents = revView ? revView.reduce((s, r) => s + Number(r.paid_cents), 0) : revenueCentsCapped;
  const outstandingCents = revView ? revView.reduce((s, r) => s + Number(r.outstanding_cents), 0) : outstandingCentsCapped;

  // Revenue by month (last 6 calendar months, most recent first).
  const byMonth = new Map<string, number>();
  for (const r of paidRows) {
    if (!r.paid_at) continue;
    const key = r.paid_at.slice(0, 7); // YYYY-MM
    byMonth.set(key, (byMonth.get(key) ?? 0) + (r.amount_cents ?? 0));
  }
  const months = [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 6);
  const maxRevenue = months.length ? Math.max(...months.map(([, c]) => c)) : 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRevenue = paidRows
    .filter((r) => r.paid_at?.slice(0, 10) === todayStr)
    .reduce((sum, r) => sum + (r.amount_cents ?? 0), 0);

  const stats = [
    { label: "Members", value: String(membersC.count ?? 0) },
    { label: "Active members", value: String(activeC.count ?? 0) },
    { label: "In the gym now", value: String(occupancyC.count ?? 0) },
    { label: "Active subscriptions", value: String(subsC.count ?? 0) },
    { label: "Renewing this week", value: String(renewingSoon ?? 0) },
    { label: "Upcoming sessions", value: String(upcomingC.count ?? 0) },
    { label: "Revenue today", value: formatMoney(todayRevenue) },
    { label: "Revenue (all paid)", value: formatMoney(revenueCents) },
    { label: "Outstanding", value: formatMoney(outstandingCents) },
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-h1 text-bone">Reports</h1>
        <p className="text-sm text-ash">Scoped to your gym(s) by row-level security.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-md border border-onyx bg-onyx p-4">
            <div className="text-xs text-ash">{s.label}</div>
            <div className="mt-1 font-display text-2xl font-extrabold tracking-tight">{s.value}</div>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Check-ins · last 7 days</h2>
        <div className="flex items-end justify-between gap-2 rounded-md border border-onyx bg-onyx p-4">
          {days.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
              <div className="text-xs text-ash">{d.count}</div>
              <div
                className={`w-full rounded-t ${d.count === maxDay && d.count > 0 ? "bg-gold" : "bg-iron"}`}
                style={{ height: `${8 + Math.round((d.count / maxDay) * 60)}px` }}
              />
              <div className="text-[10px] text-ash">{d.day.slice(5)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Members by status</h2>
        {statusRows.length === 0 ? (
          <p className="text-sm text-ash">No members yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
            {statusRows.map(([status, count]) => (
              <li key={status} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-ash">{status}</span>
                <span className="font-medium">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Revenue by month</h2>
        {months.length === 0 ? (
          <p className="text-sm text-ash">No paid invoices yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
            {months.map(([month, cents]) => (
              <li key={month} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-ash">{month}</span>
                <span className={cents === maxRevenue && maxRevenue > 0 ? "font-medium text-gold" : "font-medium"}>
                  {formatMoney(cents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
