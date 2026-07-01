import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/billing";
import { portalSignOut } from "../actions";

export const dynamic = "force-dynamic";

type Sub = { id: string; status: string; current_period_end: string | null; plan: { name: string } | null };
type Inv = { id: string; amount_cents: number; currency: string; status: string; created_at: string };
type Post = { id: string; title: string | null; body: string; created_at: string };
type Ann = { id: string; title: string; body: string | null; created_at: string };

export default async function PortalMorePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase.from("members").select("id, organization:organizations(name)").eq("profile_id", user.id);
  const ids = ((memberData ?? []) as unknown as { id: string; organization: { name: string } | null }[]).map((m) => m.id);
  const gymName = ((memberData ?? []) as unknown as { organization: { name: string } | null }[])[0]?.organization?.name ?? "your gym";
  if (ids.length === 0) redirect("/portal");

  const [{ data: subData }, { data: invData }, { data: postData }, { data: annData }] = await Promise.all([
    supabase.from("subscriptions").select("id, status, current_period_end, plan:plans(name)").in("member_id", ids).order("created_at", { ascending: false }).limit(5),
    supabase.from("invoices").select("id, amount_cents, currency, status, created_at").in("member_id", ids).order("created_at", { ascending: false }).limit(20),
    supabase.from("community_posts").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(10),
    supabase.from("announcements").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(5),
  ]);

  const subs = (subData ?? []) as unknown as Sub[];
  const invoices = (invData ?? []) as unknown as Inv[];
  const posts = (postData ?? []) as unknown as Post[];
  const anns = (annData ?? []) as unknown as Ann[];
  const activeSub = subs.find((s) => s.status === "active") ?? subs[0];
  const daysLeft = activeSub?.current_period_end
    ? Math.ceil((Date.parse(activeSub.current_period_end) - new Date().getTime()) / 86400000)
    : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-bone">More</h1>
        <form action={portalSignOut}><button className="text-xs text-ash hover:text-gold">Sign out</button></form>
      </div>

      {/* Membership */}
      <section className="rounded-2xl border border-iron bg-onyx p-4">
        <div className="text-[15px] font-bold text-bone">Membership</div>
        {activeSub ? (
          <div className="mt-2 flex items-center justify-between">
            <div>
              <div className="font-semibold text-bone">{activeSub.plan?.name ?? "Plan"}</div>
              <div className="mono text-xs text-ash">{activeSub.status}</div>
            </div>
            {daysLeft != null ? (
              <div className="text-right">
                <div className={`mono text-2xl font-extrabold ${daysLeft <= 7 ? "text-warn" : "text-bone"}`}>{daysLeft}</div>
                <div className="text-[10px] uppercase tracking-[0.07em] text-ash">days left</div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-1 text-sm text-ash">No active plan on file.</p>
        )}
      </section>

      {/* Gym news */}
      {anns.length > 0 ? (
        <section>
          <div className="mb-2 text-[15px] font-bold text-bone">{gymName} news</div>
          <ul className="flex flex-col gap-2">
            {anns.map((a) => (
              <li key={a.id} className="rounded-xl border border-l-2 border-iron border-l-gold bg-onyx p-3">
                <div className="text-sm font-semibold text-bone">{a.title}</div>
                {a.body ? <p className="mt-0.5 text-sm text-ash">{a.body}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Community feed */}
      <section>
        <div className="mb-2 text-[15px] font-bold text-bone">Community</div>
        {posts.length === 0 ? (
          <div className="rounded-2xl border border-iron bg-onyx p-4 text-sm text-ash">No community posts yet.</div>
        ) : (
          <ul className="flex flex-col gap-2">
            {posts.map((p) => (
              <li key={p.id} className="rounded-2xl border border-iron bg-onyx p-4">
                {p.title ? <div className="font-bold text-bone">{p.title}</div> : null}
                <p className="mt-0.5 text-sm text-ash">{p.body}</p>
                <p className="mono mt-1 text-[10px] text-ash-dim">{new Date(p.created_at).toLocaleDateString()}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/portal/help" className="flex items-center justify-between rounded-2xl border border-iron bg-onyx px-4 py-3 text-sm font-semibold text-bone">
        Help &amp; info<span className="text-gold">→</span>
      </Link>

      {/* Payment history */}
      <section>
        <div className="mb-2 text-[15px] font-bold text-bone">Payment history</div>
        {invoices.length === 0 ? (
          <div className="rounded-2xl border border-iron bg-onyx p-4 text-sm text-ash">No invoices yet.</div>
        ) : (
          <ul className="flex flex-col divide-y divide-iron rounded-2xl border border-iron bg-onyx">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="mono text-ash">{new Date(inv.created_at).toLocaleDateString()}</span>
                <span className="mono font-semibold text-bone">{formatMoney(inv.amount_cents, inv.currency)}</span>
                <span className={`text-xs ${inv.status === "paid" ? "text-win" : inv.status === "open" ? "text-warn" : "text-ash"}`}>{inv.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
