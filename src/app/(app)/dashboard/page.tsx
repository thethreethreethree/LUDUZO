import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NAV_GROUPS } from "@/lib/nav";
import { formatMoney } from "@/lib/billing";
import { Icon, type IconName } from "@/components/Icon";
import {
  StatBlock, ProgressBar, AlertItem, Card, CardHeader,
  SectionLabel, btnGold, btnSecondary,
} from "@/components/ui";

export const dynamic = "force-dynamic";

type Membership = { role: string; status: string; organization: { name: string; slug: string } | null };
type Evt = { id: number; event_type: string; occurred_at: string; payload: Record<string, unknown> };
type Session = {
  id: string; starts_at: string; capacity: number | null; status: string;
  class: { name: string; capacity: number | null } | null;
};

function greeting(h: number) {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const EVENT_LABEL: Record<string, string> = {
  "member.checkin": "checked in",
  "member.checkout": "checked out",
  "member.created": "new member added",
  "member.status_changed": "membership status changed",
  "organization.created": "gym created",
  "subscription.created": "started a plan",
  "invoice.paid": "invoice paid",
  "task.created": "task created",
  "lead.created": "new lead",
  "gift_card.issued": "gift card issued",
  "review.submitted": "left a review",
  "badge.awarded": "earned a badge",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const name = (user.email?.split("@")[0] ?? "there").replace(/^\w/, (c) => c.toUpperCase());

  const { data: memData } = await supabase
    .from("organization_members")
    .select("role, status, organization:organizations(name, slug)");
  const memberships = (memData ?? []) as unknown as Membership[];

  if (memberships.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-7 py-10">
        <Card className="text-center">
          <h1 className="text-h1 text-bone">You&apos;re not in the arena yet</h1>
          <p className="mt-2 text-sm text-ash">Set up your gym to open the command post.</p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/onboarding" className={btnGold}>Set up your gym</Link>
            <Link href="/portal" className={btnSecondary}>I&apos;m a member →</Link>
          </div>
        </Card>
      </main>
    );
  }

  const org = memberships[0];
  const [
    { count: activeMembers }, { count: occupancy }, { count: checkinsToday },
    { data: locData }, { data: invToday }, { data: eventsData }, { data: sessionData },
    { count: overdueCount }, { count: unsignedCount }, { data: todayCheckins },
  ] = await Promise.all([
    supabase.from("members").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("checkins").select("id", { count: "exact", head: true }).is("checked_out_at", null),
    supabase.from("checkins").select("id", { count: "exact", head: true }).gte("checked_in_at", todayStart),
    supabase.from("locations").select("capacity"),
    supabase.from("invoices").select("amount_cents").eq("status", "paid").gte("created_at", todayStart),
    supabase.from("events").select("id, event_type, occurred_at, payload").order("occurred_at", { ascending: false }).limit(8),
    supabase.from("class_sessions").select("id, starts_at, capacity, status, class:classes(name, capacity)").gte("starts_at", todayStart).order("starts_at").limit(6),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "open").lt("due_date", todayStart.slice(0, 10)),
    supabase.from("member_documents").select("id", { count: "exact", head: true }).neq("status", "signed"),
    supabase.from("checkins").select("checked_in_at").gte("checked_in_at", todayStart).limit(2000),
  ]);

  const capacity = ((locData ?? []) as { capacity: number | null }[]).reduce((s, l) => s + (l.capacity ?? 0), 0) || 60;
  const occ = occupancy ?? 0;
  const revToday = ((invToday ?? []) as { amount_cents: number }[]).reduce((s, i) => s + i.amount_cents, 0);
  const events = (eventsData ?? []) as unknown as Evt[];
  const sessions = (sessionData ?? []) as unknown as Session[];

  // Traffic-by-hour buckets from today's check-ins
  const hours = [6, 8, 10, 12, 14, 16, 18, 20];
  const buckets = hours.map(() => 0);
  for (const c of (todayCheckins ?? []) as { checked_in_at: string }[]) {
    const h = new Date(c.checked_in_at).getHours();
    let idx = 0; for (let i = 0; i < hours.length; i++) if (h >= hours[i]) idx = i;
    buckets[idx]++;
  }
  const maxBucket = Math.max(...buckets, 1);
  const nowHourIdx = (() => { let idx = 0; const h = now.getHours(); for (let i = 0; i < hours.length; i++) if (h >= hours[i]) idx = i; return idx; })();

  // Booking counts per session
  const sessionIds = sessions.map((s) => s.id);
  const bookingCounts = new Map<string, number>();
  if (sessionIds.length) {
    const { data: bk } = await supabase.from("bookings").select("session_id").in("session_id", sessionIds).in("status", ["booked", "attended"]);
    for (const r of (bk ?? []) as { session_id: string }[]) bookingCounts.set(r.session_id, (bookingCounts.get(r.session_id) ?? 0) + 1);
  }

  const alerts = [
    overdueCount ? { icon: "alert", title: `${overdueCount} overdue payment${overdueCount > 1 ? "s" : ""}`, subtext: "Collect at the desk or suspend", href: "/dashboard/invoices" } : null,
    unsignedCount ? { icon: "document", title: `${unsignedCount} unsigned waiver${unsignedCount > 1 ? "s" : ""}`, subtext: "New members need to sign", href: "/dashboard/documents" } : null,
  ].filter(Boolean) as { icon: IconName; title: string; subtext: string; href: string }[];

  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-7 py-8">
      {/* Greeting + actions */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1 text-bone">{greeting(now.getHours())}, {name}</h1>
          <p className="mt-1 text-sm text-ash">
            {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · Here&apos;s what&apos;s happening in the arena today.
          </p>
          <p className="mt-1 text-xs font-semibold text-ash">
            {org.organization?.name ?? "Your gym"} · <span className="text-gold uppercase">{org.role}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/checkins" className={btnSecondary}>Open front desk</Link>
          <Link href="/dashboard/members/new" className={btnGold}>+ Add member</Link>
        </div>
      </div>

      {/* Live stat band */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatBlock label="In the arena now" value={occ} unit={`/ ${capacity}`} hero>
          <div className="mt-3">
            <ProgressBar pct={(occ / capacity) * 100} />
            <div className="mono mt-1.5 text-[11px] text-ash">{Math.round((occ / capacity) * 100)}% capacity</div>
          </div>
        </StatBlock>
        <StatBlock label="Check-ins today" value={checkinsToday ?? 0} />
        <StatBlock label="Revenue today" value={formatMoney(revToday)} />
        <StatBlock label="Active members" value={(activeMembers ?? 0).toLocaleString()} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Traffic + classes (2 cols) */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader title="Traffic today" action="Full analytics →" href="/dashboard/analytics" />
            {buckets.every((b) => b === 0) ? (
              <p className="py-6 text-center text-sm text-ash">No check-ins yet today — the floor is quiet.</p>
            ) : (
              <div className="flex items-end gap-2" style={{ height: 140 }}>
                {buckets.map((b, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                    <div className={`w-full rounded-t ${i === nowHourIdx ? "bg-gold" : "bg-iron"}`} style={{ height: `${(b / maxBucket) * 110}px`, minHeight: 3 }} />
                    <span className="mono text-[10px] text-ash-dim">{hours[i]}:00</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Today's classes" action="Manage schedule →" href="/dashboard/classes" />
            {sessions.length === 0 ? (
              <p className="py-4 text-center text-sm text-ash">No classes scheduled today. <Link href="/dashboard/classes" className="text-gold">Add one →</Link></p>
            ) : (
              <ul className="flex flex-col gap-3">
                {sessions.map((s) => {
                  const cap = s.capacity ?? s.class?.capacity ?? null;
                  const booked = bookingCounts.get(s.id) ?? 0;
                  const full = cap != null && booked >= cap;
                  return (
                    <li key={s.id} className="flex items-center gap-4 text-sm">
                      <span className="mono w-14 shrink-0 text-xs text-ash">{new Date(s.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-bone">{s.class?.name ?? "Class"}{full ? <span className="ml-2 text-xs font-bold text-gold">FULL</span> : null}</div>
                      </div>
                      <div className="flex w-28 items-center gap-2">
                        <ProgressBar pct={cap ? (booked / cap) * 100 : 0} className="flex-1" />
                        <span className="mono w-10 shrink-0 text-right text-[11px] text-ash">{booked}/{cap ?? "∞"}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* Needs attention + live activity */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Needs your attention" />
            {alerts.length === 0 ? (
              <p className="py-3 text-center text-sm text-ash">All clear — nothing needs you right now.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {alerts.map((a, i) => <AlertItem key={i} icon={<Icon name={a.icon} size={16} />} title={a.title} subtext={a.subtext} href={a.href} />)}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Live activity" action="View all →" href="/dashboard/activity" />
            {events.length === 0 ? (
              <p className="py-3 text-center text-sm text-ash">No activity yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    <div className="min-w-0">
                      <span className="text-bone">{EVENT_LABEL[e.event_type] ?? e.event_type}</span>
                      <span className="mono ml-1 block text-[11px] text-ash-dim">{new Date(e.occurred_at).toLocaleString([], { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Module directory (the old link-wall, disciplined) */}
      <div className="mt-2 border-t border-iron pt-6">
        <SectionLabel>All modules</SectionLabel>
        <div className="mt-4 grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {NAV_GROUPS.map((g) => (
            <div key={g.title}>
              <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-ash-dim">{g.title}</div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-ash transition-colors hover:text-gold">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
