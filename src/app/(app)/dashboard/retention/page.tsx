import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Member = { id: string; first_name: string; last_name: string; status: string };
type Checkin = { member_id: string; checked_in_at: string };

// Honest heuristic (NOT "AI", per §3.4): a member is "at risk" when their last check-in is
// older than the threshold. The SIGNAL (days since last visit) is shown explicitly (§3.2),
// and each flag is paired with a suggested next action (§3.3 / ThinkerThinker A7) — the tool
// helps, it does not just render a verdict.
const AT_RISK_DAYS = 21;

export default async function RetentionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase
    .from("members")
    .select("id, first_name, last_name, status")
    .eq("status", "active")
    .limit(2000);
  const members = (memberData ?? []) as unknown as Member[];

  const { data: checkinData } = await supabase
    .from("checkins")
    .select("member_id, checked_in_at")
    .order("checked_in_at", { ascending: false })
    .limit(10000);
  const checkins = (checkinData ?? []) as unknown as Checkin[];

  const lastVisit = new Map<string, number>();
  for (const c of checkins) {
    const t = Date.parse(c.checked_in_at);
    if (!lastVisit.has(c.member_id)) lastVisit.set(c.member_id, t);
  }

  const now = new Date().getTime();
  const scored = members.map((m) => {
    const last = lastVisit.get(m.id);
    const days = last ? Math.floor((now - last) / (24 * 3600 * 1000)) : null;
    return { ...m, days, neverVisited: last == null };
  });
  const atRisk = scored
    .filter((m) => m.neverVisited || (m.days != null && m.days >= AT_RISK_DAYS))
    .sort((a, b) => (b.days ?? 99999) - (a.days ?? 99999));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">← Dashboard</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Retention &amp; at-risk</h1>
        <p className="text-sm text-zinc-500">
          Active members who haven&apos;t checked in for {AT_RISK_DAYS}+ days. This is a simple
          activity heuristic, not a prediction — the signal is shown so you can judge it.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-onyx bg-onyx p-4">
          <div className="text-xs text-ash">Active members</div>
          <div className="mt-1 font-display text-2xl font-extrabold">{members.length}</div>
        </div>
        <div className="rounded-md border border-onyx bg-onyx p-4">
          <div className="text-xs text-ash">At risk</div>
          <div className="mt-1 font-display text-2xl font-extrabold text-gold">{atRisk.length}</div>
        </div>
        <div className="rounded-md border border-onyx bg-onyx p-4">
          <div className="text-xs text-ash">Never visited</div>
          <div className="mt-1 font-display text-2xl font-extrabold">{scored.filter((m) => m.neverVisited).length}</div>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-zinc-500">Reach out</h2>
        {atRisk.length === 0 ? (
          <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-zinc-500">
            No at-risk members — everyone active has visited recently. 💪
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx">
            {atRisk.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">{m.first_name} {m.last_name}</span>
                  <span className="text-xs text-gold">
                    {m.neverVisited ? "Never checked in" : `${m.days} days since last visit`}
                  </span>
                </div>
                <Link
                  href={`/dashboard/members/${m.id}`}
                  className="rounded-md border border-iron px-3 py-1.5 text-xs font-medium hover:border-gold hover:text-gold"
                >
                  Open &amp; reach out →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
