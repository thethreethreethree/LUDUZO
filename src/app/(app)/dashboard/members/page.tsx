import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MEMBER_STATUSES } from "@/lib/members";
import { StatBlock, Avatar, PlanBadge, StatusPill, memberStatusKind, btnGold, btnSecondary } from "@/components/ui";

export const dynamic = "force-dynamic";

type MemberRow = { id: string; first_name: string; last_name: string; email: string | null; status: string; member_number: string | null };
const PAGE_SIZE = 25;
const RISK_DAYS = 21;

function currentStreak(daysDesc: string[]): number {
  if (daysDesc.length === 0) return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const set = new Set(daysDesc);
  // streak counts back from today or yesterday
  let cursor = new Date(today);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (!set.has(iso(cursor))) { cursor.setDate(cursor.getDate() - 1); if (!set.has(iso(cursor))) return 0; }
  let n = 0;
  while (set.has(iso(cursor))) { n++; cursor.setDate(cursor.getDate() - 1); }
  return n;
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string; ok?: string }>;
}) {
  const { q, page: pageRaw, status: statusRaw, ok } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const status = (MEMBER_STATUSES as readonly string[]).includes(statusRaw ?? "") ? (statusRaw as string) : "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let query = supabase
    .from("members")
    .select("id, first_name, last_name, email, status, member_number", { count: "exact" })
    .order("last_name", { ascending: true })
    .range(from, to);
  const term = (q ?? "").trim().replace(/[%,*()]/g, "");
  if (term) query = query.or(`first_name.ilike.*${term}*,last_name.ilike.*${term}*,email.ilike.*${term}*`);
  if (status) query = query.eq("status", status);

  const [
    { data: rowData, count: total },
    { count: activeCount }, { count: frozenCount }, { count: monthCount },
    { data: activeIds }, { data: allCheckins }, { data: overdueInv },
  ] = await Promise.all([
    query,
    supabase.from("members").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("status", "frozen"),
    supabase.from("members").select("id", { count: "exact", head: true }).gte("member_since", monthStart),
    supabase.from("members").select("id").eq("status", "active").limit(5000),
    supabase.from("checkins").select("member_id, checked_in_at").order("checked_in_at", { ascending: false }).limit(20000),
    supabase.from("invoices").select("member_id").eq("status", "open").lt("due_date", now.toISOString().slice(0, 10)).limit(5000),
  ]);

  const members = (rowData ?? []) as unknown as MemberRow[];

  // last visit + streak per member (from all check-ins)
  const lastVisit = new Map<string, number>();
  const daysByMember = new Map<string, Set<string>>();
  for (const c of (allCheckins ?? []) as { member_id: string; checked_in_at: string }[]) {
    const t = Date.parse(c.checked_in_at);
    if (!lastVisit.has(c.member_id)) lastVisit.set(c.member_id, t);
    const day = new Date(c.checked_in_at).toISOString().slice(0, 10);
    if (!daysByMember.has(c.member_id)) daysByMember.set(c.member_id, new Set());
    daysByMember.get(c.member_id)!.add(day);
  }

  // churn-risk count over active members
  const nowMs = now.getTime();
  const activeIdSet = new Set(((activeIds ?? []) as { id: string }[]).map((r) => r.id));
  let atRisk = 0;
  for (const id of activeIdSet) {
    const lv = lastVisit.get(id);
    if (lv == null || (nowMs - lv) / 86400000 >= RISK_DAYS) atRisk++;
  }
  const overdueMembers = new Set(((overdueInv ?? []) as { member_id: string | null }[]).map((r) => r.member_id).filter(Boolean)).size;

  // plans for the visible rows
  const visibleIds = members.map((m) => m.id);
  const planByMember = new Map<string, string>();
  if (visibleIds.length) {
    const { data: subs } = await supabase.from("subscriptions").select("member_id, status, plan:plans(name)").in("member_id", visibleIds).eq("status", "active");
    for (const s of (subs ?? []) as unknown as { member_id: string; plan: { name: string } | null }[]) if (s.plan?.name) planByMember.set(s.member_id, s.plan.name);
  }

  const chips: { key: string; label: string }[] = [
    { key: "", label: "All" }, { key: "active", label: "Active" },
    { key: "frozen", label: "Frozen" }, { key: "pending", label: "Pending" }, { key: "inactive", label: "Inactive" },
  ];
  const chipHref = (k: string) => `?${new URLSearchParams({ ...(term ? { q: term } : {}), ...(k ? { status: k } : {}) }).toString()}`;
  const pageHref = (p: number) => `?${new URLSearchParams({ ...(term ? { q: term } : {}), ...(status ? { status } : {}), page: String(p) }).toString()}`;
  const totalPages = Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE));

  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-7 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mono text-xs text-ash-dim"><Link href="/dashboard" className="hover:text-gold">Home</Link> / Members</div>
          <h1 className="mt-1 text-h1 text-bone">Members</h1>
          <p className="mt-1 text-sm text-ash"><span className="mono">{(activeCount ?? 0).toLocaleString()}</span> active · <span className="mono">{monthCount ?? 0}</span> joined this month</p>
        </div>
        <div className="flex gap-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/dashboard/members/export" className={btnSecondary}>↓ Export</a>
          <Link href="/dashboard/members/new" className={btnGold}>+ Add member</Link>
        </div>
      </div>

      {ok ? (
        <p className="rounded-md border border-win/40 bg-win/10 px-3 py-2 text-sm text-win">✓ {ok}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatBlock label="Active" value={(activeCount ?? 0).toLocaleString()} />
        <StatBlock label="At churn risk" value={atRisk}><span className="mono mt-1 block text-[11px] text-warn">≥{RISK_DAYS}d no visit</span></StatBlock>
        <StatBlock label="Payment overdue" value={overdueMembers}><span className="mono mt-1 block text-[11px] text-loss">needs collection</span></StatBlock>
        <StatBlock label="Frozen / paused" value={frozenCount ?? 0} />
      </div>

      {/* search + filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <form className="min-w-[220px] flex-1">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input type="search" name="q" defaultValue={q ?? ""} placeholder="Search by name, email, or member ID…" className="w-full rounded-md border border-iron bg-onyx-2 px-3.5 py-2 text-sm text-bone placeholder:text-ash-dim" />
        </form>
        <div className="flex gap-1.5">
          {chips.map((c) => {
            const on = status === c.key;
            return <Link key={c.key} href={chipHref(c.key)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${on ? "bg-gold text-black" : "border border-iron text-ash hover:text-bone"}`}>{c.label}</Link>;
          })}
        </div>
      </div>

      {/* roster table */}
      {members.length === 0 ? (
        <div className="rounded-md border border-iron bg-onyx p-8 text-center text-sm text-ash">{term || status ? "No members match." : "No members yet. Add your first one."}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-iron bg-onyx">
          <div className="grid grid-cols-[2.2fr_1fr_1fr_1fr_0.7fr_auto] items-center gap-3 border-b border-iron bg-onyx-2 px-4.5 py-3 text-[11px] font-bold uppercase tracking-[0.07em] text-ash">
            <span>Member</span><span>Plan</span><span>Status</span><span>Last check-in</span><span>Streak</span><span />
          </div>
          {members.map((m) => {
            const nm = `${m.first_name} ${m.last_name}`;
            const lv = lastVisit.get(m.id);
            const streak = currentStreak([...(daysByMember.get(m.id) ?? [])]);
            const plan = planByMember.get(m.id);
            return (
              <Link key={m.id} href={`/dashboard/members/${m.id}`} className="group grid grid-cols-[2.2fr_1fr_1fr_1fr_0.7fr_auto] items-center gap-3 border-b border-iron px-4.5 py-3 transition-colors last:border-0 hover:bg-onyx-2">
                <span className="flex items-center gap-3">
                  <Avatar name={nm} size={34} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-bone">{nm}</span>
                    <span className="mono block truncate text-[11px] text-ash-dim">{m.email ?? ""}{m.member_number ? ` · ${m.member_number}` : ""}</span>
                  </span>
                </span>
                <span>{plan ? <PlanBadge label={plan} /> : <span className="text-xs text-ash-dim">—</span>}</span>
                <span><StatusPill status={memberStatusKind(m.status)} label={m.status[0].toUpperCase() + m.status.slice(1)} /></span>
                <span className="mono text-xs text-ash">{lv ? new Date(lv).toLocaleDateString([], { month: "short", day: "numeric" }) : "never"}</span>
                <span className="mono text-xs text-bone">{streak > 0 ? `🔥 ${streak}` : "—"}</span>
                <span className="text-ash-dim group-hover:text-gold">→</span>
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-ash">
          <span className="mono text-xs">Page {page} of {totalPages} · {(total ?? 0).toLocaleString()} members</span>
          <div className="flex gap-2">
            {page > 1 ? <Link href={pageHref(page - 1)} className={btnSecondary}>← Prev</Link> : null}
            {page < totalPages ? <Link href={pageHref(page + 1)} className={btnSecondary}>Next →</Link> : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
