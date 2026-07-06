import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/billing";
import { Icon } from "@/components/Icon";
import { SubmitButton } from "@/components/SubmitButton";
import { portalSignOut, addMemberComment, updateMyProfile, markNotificationsRead, submitReferral, updateMyGoals, setNotifPrefs, redeemReward } from "../actions";

const NOTIF_LABELS: { kind: string; label: string }[] = [
  { kind: "waitlist_promoted", label: "Waitlist spots" },
  { kind: "document_assigned", label: "Documents to sign" },
  { kind: "invoice_created", label: "New invoices" },
];

export const dynamic = "force-dynamic";

const OK_MSG: Record<string, string> = { contact: "Contact details updated.", profile: "Your details were updated.", referred: "Referral sent — thanks for spreading the word.", goals: "Goals saved.", redeemed: "Reward redeemed. The front desk will sort you out." };

type Referral = { id: string; referred_name: string | null; status: string; created_at: string };

type Sub = { id: string; status: string; current_period_end: string | null; plan: { name: string } | null };
type Inv = { id: string; amount_cents: number; currency: string; status: string; created_at: string };
type Comment = { id: string; body: string; author_id: string | null; author_member_id: string | null };
type Post = { id: string; organization_id: string; title: string | null; body: string; created_at: string; author_id: string | null; community_comments: Comment[] };
type Ann = { id: string; title: string; body: string | null; created_at: string };
type Notif = { id: string; kind: string; title: string; body: string | null; read_at: string | null; created_at: string };

export default async function PortalMorePage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase.from("members").select("id, first_name, last_name, phone, organization:organizations(name)").eq("profile_id", user.id);
  const memberRows = ((memberData ?? []) as unknown as { id: string; first_name: string; last_name: string; phone: string | null; organization: { name: string } | null }[]);
  const ids = memberRows.map((m) => m.id);
  const gymName = memberRows[0]?.organization?.name ?? "your gym";
  const me0 = memberRows[0];
  if (ids.length === 0) redirect("/portal");

  // Goals/fitness_level in a SEPARATE query so a missing column (0050 unapplied)
  // fails only here, never breaking the page.
  const { data: goalsData } = await supabase.from("members").select("goals, fitness_level").eq("profile_id", user.id).limit(1);
  const myGoals = ((goalsData ?? []) as { goals: string | null; fitness_level: string | null }[])[0] ?? null;

  const [{ data: subData }, { data: invData }, { data: postData }, { data: annData }, { data: staffData }, { data: notifData }, { data: memberDir }, { data: refData }, { data: loyData }, { data: rewardData }, { data: lockerData }, { data: myDocData }] = await Promise.all([
    supabase.from("subscriptions").select("id, status, current_period_end, plan:plans(name)").in("member_id", ids).order("created_at", { ascending: false }).limit(5),
    supabase.from("invoices").select("id, amount_cents, currency, status, created_at").in("member_id", ids).order("created_at", { ascending: false }).limit(20),
    supabase.from("community_posts").select("id, organization_id, title, body, created_at, author_id, community_comments(id, body, author_id, author_member_id)").order("created_at", { ascending: false }).limit(10),
    supabase.from("announcements").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(5),
    // Staff names for post/comment attribution (0040, name-only). Posts are always
    // staff-authored; comments may be staff or member. Member-authored comment
    // attribution is deferred (needs a member-to-member name-visibility decision).
    supabase.from("gym_staff_directory").select("user_id, full_name"),
    supabase.from("notifications").select("id, kind, title, body, read_at, created_at").in("member_id", ids).order("created_at", { ascending: false }).limit(15),
    // Member first names for community comment attribution (0044, first-name-only).
    supabase.from("gym_member_directory").select("member_id, first_name"),
    // Own referrals (0049; empty until applied).
    supabase.from("referrals").select("id, referred_name, status, created_at").in("referrer_member_id", ids).order("created_at", { ascending: false }).limit(10),
    // §9 loyalty points history (own-read, 0016). High limit so the balance sum +
    // affordability are accurate for active members, not just the last 50 (audit F2).
    supabase.from("loyalty_transactions").select("id, points, reason, created_at").in("member_id", ids).order("created_at", { ascending: false }).limit(2000),
    // §9 rewards catalog (active, member-readable — 0055; empty until applied).
    supabase.from("rewards").select("id, name, description, cost_points").eq("active", true).order("cost_points", { ascending: true }).limit(20),
    // Own active locker rental (0060 member-read; empty until applied — cat 3).
    supabase.from("locker_rentals").select("locker_label, monthly_fee_cents, status, ends_on").in("member_id", ids).eq("status", "active").order("starts_on", { ascending: false }).limit(1),
    // Own documents — signed AND pending. Home only shows UNSIGNED (to prompt); this
    // gives the member a surface to see waivers/contracts they've signed (A10).
    supabase.from("member_documents").select("id, kind, status, signed_at").in("member_id", ids).order("created_at", { ascending: false }).limit(20),
  ]);
  const locker = ((lockerData ?? []) as { locker_label: string; monthly_fee_cents: number; status: string; ends_on: string | null }[])[0] ?? null;
  const documents = ((myDocData ?? []) as { id: string; kind: string; status: string; signed_at: string | null }[]);
  const staffName = new Map(((staffData ?? []) as { user_id: string; full_name: string | null }[]).map((s) => [s.user_id, s.full_name]));
  const memberName = new Map(((memberDir ?? []) as { member_id: string; first_name: string | null }[]).map((m) => [m.member_id, m.first_name]));
  const referrals = (refData ?? []) as unknown as Referral[];
  const loyalty = (loyData ?? []) as unknown as { id: string; points: number; reason: string | null; created_at: string }[];
  // TRUE balance from the 0059 aggregate view; fall back to summing the fetched
  // history if the view isn't applied. The history query above still drives the list.
  const { data: balData, error: balErr } = await supabase.from("member_points_balance").select("balance").in("member_id", ids);
  const pointsBalance = (!balErr && balData)
    ? (balData as { balance: number }[]).reduce((s, r) => s + (r.balance ?? 0), 0)
    : loyalty.reduce((s, t) => s + (t.points ?? 0), 0);
  const rewards = (rewardData ?? []) as unknown as { id: string; name: string; description: string | null; cost_points: number }[];

  const subs = (subData ?? []) as unknown as Sub[];
  const invoices = (invData ?? []) as unknown as Inv[];
  const posts = (postData ?? []) as unknown as Post[];
  const anns = (annData ?? []) as unknown as Ann[];
  const muted = new Set(((await cookies()).get("notif_mute")?.value ?? "").split(",").filter(Boolean));
  const notifs = ((notifData ?? []) as unknown as Notif[]).filter((n) => !muted.has(n.kind));
  const unread = notifs.filter((n) => !n.read_at).length;
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

      {ok ? <p className="rounded-md border border-win/40 bg-win/10 px-3 py-2 text-sm text-win">{OK_MSG[ok] ?? "Done."}</p> : null}
      {error ? <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p> : null}

      {/* Notifications inbox (0043) — waitlist spot-opened alerts + future events. */}
      {notifs.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[15px] font-bold text-bone">Notifications{unread > 0 ? <span className="ml-2 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-black">{unread}</span> : null}</div>
            {unread > 0 ? (
              <form action={markNotificationsRead}><button className="text-xs text-ash hover:text-gold">Mark all read</button></form>
            ) : null}
          </div>
          <ul className="flex flex-col gap-2">
            {notifs.map((n) => (
              <li key={n.id} className={`rounded-2xl border p-4 ${n.read_at ? "border-iron bg-onyx" : "border-gold-line bg-gold-dim"}`}>
                <div className="flex items-center gap-2">
                  {!n.read_at ? <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-gold" /> : null}
                  <span className="font-bold text-bone">{n.title}</span>
                </div>
                {n.body ? <p className="mt-0.5 text-sm text-ash">{n.body}</p> : null}
                <p className="mono mt-1 text-[10px] text-ash-dim">{new Date(n.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* §12 notification preferences — always visible so muted types can be re-enabled */}
      <details className="rounded-2xl border border-iron bg-onyx p-4 [&_summary]:cursor-pointer">
        <summary className="text-[13px] font-semibold text-ash">Notification settings</summary>
        <form action={setNotifPrefs} className="mt-3 flex flex-col gap-2">
          {NOTIF_LABELS.map((n) => (
            <label key={n.kind} className="flex items-center gap-2 text-sm text-bone">
              <input type="checkbox" name={`show_${n.kind}`} defaultChecked={!muted.has(n.kind)} className="h-4 w-4 accent-gold" />
              {n.label}
            </label>
          ))}
          <button className="mt-1 self-start rounded-md border border-iron px-4 py-1.5 text-xs font-semibold text-ash hover:border-gold hover:text-gold">Save preferences</button>
        </form>
      </details>

      {/* Your details — member self-edit of name + phone (0045 RPC). Email stays
          front-desk-only per founder decision. */}
      <section className="rounded-2xl border border-iron bg-onyx p-4">
        <div className="text-[15px] font-bold text-bone">Your details</div>
        <form action={updateMyProfile} className="mt-2 flex flex-col gap-2">
          <div className="flex gap-2">
            <input name="first_name" aria-label="First name" defaultValue={me0?.first_name ?? ""} required placeholder="First name" className="min-w-0 flex-1 rounded-md border border-iron bg-onyx-2 px-3 py-2 text-sm text-bone placeholder:text-ash-dim" />
            <input name="last_name" aria-label="Last name" defaultValue={me0?.last_name ?? ""} required placeholder="Last name" className="min-w-0 flex-1 rounded-md border border-iron bg-onyx-2 px-3 py-2 text-sm text-bone placeholder:text-ash-dim" />
          </div>
          <div className="flex gap-2">
            <input name="phone" aria-label="Phone number" defaultValue={me0?.phone ?? ""} inputMode="tel" placeholder="Phone number" className="min-w-0 flex-1 rounded-md border border-iron bg-onyx-2 px-3 py-2 text-sm text-bone placeholder:text-ash-dim" />
            <button className="shrink-0 rounded-md bg-gold px-4 py-2 text-sm font-bold text-black hover:brightness-110">Save</button>
          </div>
        </form>
        <p className="mt-1.5 text-[11px] text-ash-dim">To change your email, ask the front desk.</p>
      </section>

      {/* Goals + fitness level — member self-set (0050) */}
      <section className="rounded-2xl border border-iron bg-onyx p-4">
        <div className="text-[15px] font-bold text-bone">Your goals</div>
        <form action={updateMyGoals} className="mt-2 flex flex-col gap-2">
          <select name="fitness_level" aria-label="Fitness level" defaultValue={myGoals?.fitness_level ?? ""} className="w-full rounded-md border border-iron bg-onyx-2 px-3 py-2 text-sm text-bone">
            <option value="">Fitness level…</option>
            {["Beginner", "Intermediate", "Advanced"].map((l) => (<option key={l} value={l}>{l}</option>))}
          </select>
          <textarea name="goals" aria-label="Your training goals" rows={2} defaultValue={myGoals?.goals ?? ""} placeholder="What are you training for? (e.g. lose 5kg, first 5k, build strength)" className="w-full rounded-md border border-iron bg-onyx-2 px-3 py-2 text-sm text-bone placeholder:text-ash-dim" />
          <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-bold text-black hover:brightness-110">Save goals</button>
        </form>
      </section>

      {/* Refer a friend (0049) */}
      <section className="rounded-2xl border border-iron bg-onyx p-4">
        <div className="text-[15px] font-bold text-bone">Refer a friend</div>
        <p className="mt-0.5 text-xs text-ash">Know someone who&apos;d love {gymName}? Send us their details and we&apos;ll reach out.</p>
        <form action={submitReferral} className="mt-2 flex flex-col gap-2">
          <input name="referred_name" aria-label="Friend's name" required placeholder="Friend's name" className="w-full rounded-md border border-iron bg-onyx-2 px-3 py-2 text-sm text-bone placeholder:text-ash-dim" />
          <div className="flex gap-2">
            <input name="referred_email" aria-label="Friend's email (optional)" type="email" placeholder="Their email (optional)" className="min-w-0 flex-1 rounded-md border border-iron bg-onyx-2 px-3 py-2 text-sm text-bone placeholder:text-ash-dim" />
            <button className="shrink-0 rounded-md bg-gold px-4 py-2 text-sm font-bold text-black hover:brightness-110">Refer</button>
          </div>
        </form>
        {referrals.length > 0 ? (
          <ul className="mt-3 flex flex-col divide-y divide-iron border-t border-iron">
            {referrals.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate text-bone">{r.referred_name ?? "Friend"}</span>
                <span className={`text-xs ${r.status === "converted" || r.status === "joined" ? "text-win" : "text-ash"}`}>{r.status}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

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
              daysLeft < 0 ? (
                // Past the current period end (no auto-expiry job flips status yet) —
                // show "Expired", never a negative countdown.
                <div className="text-right">
                  <div className="mono text-sm font-extrabold text-loss">Expired</div>
                  <div className="text-[10px] uppercase tracking-[0.07em] text-ash">renew at the desk</div>
                </div>
              ) : (
                <div className="text-right">
                  <div className={`mono text-2xl font-extrabold ${daysLeft <= 7 ? "text-warn" : "text-bone"}`}>{daysLeft}</div>
                  <div className="text-[10px] uppercase tracking-[0.07em] text-ash">days left</div>
                </div>
              )
            ) : null}
          </div>
        ) : (
          <p className="mt-1 text-sm text-ash">No active plan on file.</p>
        )}
      </section>

      {/* Your locker (0060 member-read; cat 3 — renders only if you rent one) */}
      {locker ? (
        <section className="rounded-2xl border border-iron bg-onyx p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[15px] font-bold text-bone">Your locker</div>
              <div className="mono mt-0.5 text-xs text-ash">{formatMoney(locker.monthly_fee_cents)}/mo{locker.ends_on ? ` · term ends ${new Date(locker.ends_on).toLocaleDateString()}` : ""}</div>
            </div>
            <div className="text-right">
              <div className="mono text-2xl font-extrabold text-gold">{locker.locker_label}</div>
              <div className="text-[10px] uppercase tracking-[0.07em] text-ash">locker</div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Your documents (A10 — see signed waivers/contracts, not just pending) */}
      {documents.length > 0 ? (
        <section className="rounded-2xl border border-iron bg-onyx p-4">
          <div className="text-[15px] font-bold text-bone">Your documents</div>
          <ul className="mt-2 flex flex-col divide-y divide-iron">
            {documents.map((d) => {
              const signed = d.status === "signed";
              return (
                <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="capitalize text-bone">{d.kind.replace(/_/g, " ")}</span>
                  <span className={`mono text-xs ${signed ? "text-win" : "text-warn"}`}>
                    {signed ? `Signed${d.signed_at ? ` · ${new Date(d.signed_at).toLocaleDateString()}` : ""}` : d.status.replace(/_/g, " ")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

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
                <p className="mono mt-1 text-[10px] text-ash-dim">
                  {p.author_id && staffName.get(p.author_id) ? `${staffName.get(p.author_id)} · ` : ""}{new Date(p.created_at).toLocaleDateString()}
                </p>
                {p.community_comments.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1 border-t border-iron pt-2">
                    {p.community_comments.map((c) => {
                      const who = c.author_id ? staffName.get(c.author_id) : c.author_member_id ? memberName.get(c.author_member_id) : null;
                      return <li key={c.id} className="text-xs text-ash"><Icon name="community" size={12} className="mr-1 inline-block align-[-1px] text-ash-dim" /> {who ? <span className="font-semibold text-bone">{who}: </span> : null}{c.body}</li>;
                    })}
                  </ul>
                ) : null}
                <form action={addMemberComment} className="mt-2 flex gap-2">
                  <input type="hidden" name="post_id" value={p.id} />
                  <input name="body" aria-label="Write a reply" required placeholder="Reply…" className="min-w-0 flex-1 rounded-md border border-iron bg-onyx-2 px-3 py-1.5 text-xs text-bone placeholder:text-ash-dim" />
                  <button className="rounded-md border border-iron px-3 py-1 text-xs font-semibold text-ash hover:border-gold hover:text-gold">Send</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* §9 rewards / points wallet (loyalty_transactions own-read, 0016) */}
      <section className="rounded-2xl border border-iron bg-onyx p-4">
        <div className="flex items-center justify-between">
          <div className="text-[15px] font-bold text-bone">Rewards</div>
          <div className="mono text-lg font-extrabold text-gold">{pointsBalance.toLocaleString()} <span className="text-xs font-semibold text-ash">pts</span></div>
        </div>
        {rewards.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-2">
            {rewards.map((r) => {
              const affordable = pointsBalance >= r.cost_points;
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-iron bg-onyx-2 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-bone">{r.name}</div>
                    {r.description ? <div className="truncate text-xs text-ash">{r.description}</div> : null}
                    <div className="mono text-[11px] text-gold">{r.cost_points} pts</div>
                  </div>
                  {affordable ? (
                    <form action={redeemReward} className="shrink-0">
                      <input type="hidden" name="reward_id" value={r.id} />
                      <SubmitButton className="rounded-md bg-gold px-3 py-1.5 text-xs font-bold text-black hover:brightness-110" pendingLabel="Redeeming…">Redeem</SubmitButton>
                    </form>
                  ) : (
                    <span className="mono shrink-0 text-[11px] text-ash-dim">{r.cost_points - pointsBalance} more</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
        {loyalty.length === 0 ? (
          <p className="mt-2 text-sm text-ash">Earn points by training, referring friends, and hitting milestones.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-iron border-t border-iron pt-2">
            {loyalty.slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span className="min-w-0 truncate text-bone">{t.reason ?? "Points"}</span>
                <span className={`mono shrink-0 font-semibold ${t.points >= 0 ? "text-win" : "text-loss"}`}>{t.points >= 0 ? "+" : ""}{t.points}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/portal/help" className="flex items-center justify-between rounded-2xl border border-iron bg-onyx px-4 py-3 text-sm font-semibold text-bone">
        Help &amp; info<span className="text-gold">→</span>
      </Link>

      {/* §12 privacy — download own data (GDPR). GET route, RLS-scoped to own rows. */}
      <a href="/portal/data-export" className="flex items-center justify-between rounded-2xl border border-iron bg-onyx px-4 py-3 text-sm font-semibold text-bone hover:border-gold">
        <span>Download my data</span><span className="text-gold">↓</span>
      </a>

      {/* Payment history */}
      <section>
        <div className="mb-2 text-[15px] font-bold text-bone">Payment history</div>
        {invoices.length === 0 ? (
          <div className="rounded-2xl border border-iron bg-onyx p-4 text-sm text-ash">No invoices yet.</div>
        ) : (
          <ul className="flex flex-col divide-y divide-iron rounded-2xl border border-iron bg-onyx">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="mono text-ash">{new Date(inv.created_at).toLocaleDateString()}</span>
                <span className="mono font-semibold text-bone">{formatMoney(inv.amount_cents, inv.currency)}</span>
                <span className={`text-xs ${inv.status === "paid" ? "text-win" : inv.status === "open" ? "text-warn" : "text-ash"}`}>{inv.status}</span>
                <a href={`/portal/receipt/${inv.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-ash hover:text-gold">Receipt ↗</a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
