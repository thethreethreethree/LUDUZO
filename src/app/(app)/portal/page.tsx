import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/billing";
import { PlanBadge, btnGold, btnSecondary } from "@/components/ui";
import { claimRecords, signMyDocument, portalSignOut } from "./actions";

export const dynamic = "force-dynamic";

type MyMember = { id: string; first_name: string; last_name: string; qr_token: string | null; member_number: string | null; organization: { name: string } | null };
type Booking = { id: string; status: string; session: { starts_at: string; class: { name: string } | null } | null };
type Doc = { id: string; kind: string; status: string };

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase
    .from("members")
    .select("id, first_name, last_name, qr_token, member_number, organization:organizations(name)")
    .eq("profile_id", user.id);
  const members = (memberData ?? []) as unknown as MyMember[];
  const me = members[0] ?? null;
  const memberIds = members.map((m) => m.id);

  // ---- No linked membership: keep the claim / onboarding flow ----
  if (!me) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
        <Brand email={user.email ?? ""} />
        {error ? <ErrBanner>{error}</ErrBanner> : null}
        <div className="rounded-xl border border-iron bg-onyx p-6 text-center">
          <p className="text-sm text-bone">We couldn&apos;t find a membership linked to your account.</p>
          <p className="mt-1 text-xs text-ash">If your gym has your email on file, link it now.</p>
          <form action={claimRecords} className="mt-3"><button className={btnGold}>Find my membership</button></form>
          <div className="mt-4 border-t border-iron pt-4">
            <p className="text-xs text-ash">Run a gym instead?</p>
            <Link href="/onboarding" className={`${btnSecondary} mt-2`}>Set up your gym →</Link>
          </div>
        </div>
      </main>
    );
  }

  const [{ data: subData }, { data: visitData }, { data: loyData }, { data: openData }, { data: bookingData }, { data: docData }, { data: invData }] = await Promise.all([
    supabase.from("subscriptions").select("status, plan:plans(name)").in("member_id", memberIds).eq("status", "active").limit(1),
    supabase.from("checkins").select("checked_in_at").in("member_id", memberIds).order("checked_in_at", { ascending: false }).limit(400),
    supabase.from("loyalty_transactions").select("points").in("member_id", memberIds).limit(2000),
    supabase.from("checkins").select("id").in("member_id", memberIds).is("checked_out_at", null).limit(1),
    supabase.from("bookings").select("id, status, session:class_sessions(starts_at, class:classes(name))").in("member_id", memberIds).eq("status", "booked").limit(20),
    supabase.from("member_documents").select("id, kind, status").in("member_id", memberIds).neq("status", "signed").limit(20),
    supabase.from("invoices").select("amount_cents, status").in("member_id", memberIds).limit(500),
  ]);

  const planName = ((subData ?? []) as unknown as { plan: { name: string } | null }[])[0]?.plan?.name ?? null;
  const checkedIn = ((openData ?? []) as { id: string }[]).length > 0;
  const points = ((loyData ?? []) as { points: number }[]).reduce((s, r) => s + (r.points ?? 0), 0);
  const level = Math.max(1, Math.floor(points / 100) + 1);
  const outstanding = ((invData ?? []) as { amount_cents: number; status: string }[]).filter((i) => i.status === "open").reduce((s, i) => s + i.amount_cents, 0);
  const docs = (docData ?? []) as unknown as Doc[];

  // current streak from visit days
  const days = new Set(((visitData ?? []) as { checked_in_at: string }[]).map((v) => new Date(v.checked_in_at).toISOString().slice(0, 10)));
  const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
  const isoOf = (d: Date) => d.toISOString().slice(0, 10);
  let cursor = new Date(todayD); let streak = 0;
  if (!days.has(isoOf(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(isoOf(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  const weekMarks = [...Array(7)].map((_, i) => { const d = new Date(todayD); d.setDate(d.getDate() - (6 - i)); return { label: ["S", "M", "T", "W", "T", "F", "S"][d.getDay()], on: days.has(isoOf(d)) }; });

  const nextBooking = ((bookingData ?? []) as unknown as Booking[])
    .filter((b) => b.session && Date.parse(b.session.starts_at) > new Date().getTime())
    .sort((a, b) => Date.parse(a.session!.starts_at) - Date.parse(b.session!.starts_at))[0] ?? null;

  const qrDataUrl = me.qr_token
    ? await QRCode.toDataURL(me.qr_token, { margin: 1, width: 240, color: { dark: "#0A0A0A", light: "#FFFFFF" } })
    : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ash">Ready to train,</p>
          <h1 className="text-2xl font-extrabold text-bone">{me.first_name} 👋</h1>
        </div>
        <form action={portalSignOut}><button className="text-xs text-ash hover:text-gold">Sign out</button></form>
      </div>

      {error ? <ErrBanner>{error}</ErrBanner> : null}

      {/* ---- Arena Pass hero ---- */}
      <section id="pass" className="gold-gradient rounded-2xl border border-gold-line p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-[0.07em] text-gold">◈ Arena Pass</div>
          {checkedIn ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-win"><span className="h-[7px] w-[7px] rounded-full bg-win animate-[livepulse_2s_infinite]" />Checked in</span>
          ) : (
            <span className="text-xs text-ash">Scan at the front desk</span>
          )}
        </div>
        <div className="mt-4 flex justify-center">
          <div className="rounded-xl bg-white p-3">
            {qrDataUrl ? <Image src={qrDataUrl} alt="Your Arena Pass QR" width={200} height={200} unoptimized /> : <div className="grid h-[200px] w-[200px] place-items-center text-xs text-black">No pass yet</div>}
          </div>
        </div>
        <p className="mono mt-4 text-center text-xs text-ash">
          Member {me.member_number ? <span className="text-bone">{me.member_number}</span> : ""}{planName ? ` · ${planName}` : ""}
        </p>
      </section>

      {/* ---- Journey: level + streak ---- */}
      <section>
        <div className="mb-2 flex items-center justify-between"><h2 className="text-[15px] font-bold text-bone">Your journey</h2></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-iron bg-onyx p-4 text-center">
            <div className="text-3xl">🦁</div>
            <div className="mt-1 text-sm font-bold text-bone">Level {level}</div>
            <div className="mono text-[11px] text-ash">{points} pts</div>
          </div>
          <div className="rounded-xl border border-iron bg-onyx p-4">
            <div className="flex items-baseline gap-1.5"><span className="text-2xl">🔥</span><span className="mono text-3xl font-extrabold text-bone">{streak}</span></div>
            <div className="text-[11px] text-ash">day streak</div>
            <div className="mt-2 flex justify-between">
              {weekMarks.map((w, i) => (
                <span key={i} className={`grid h-5 w-5 place-items-center rounded text-[9px] font-bold ${w.on ? "bg-gold text-black" : "border border-iron text-ash-dim"}`}>{w.label}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Next up ---- */}
      <section id="book">
        <div className="mb-2 flex items-center justify-between"><h2 className="text-[15px] font-bold text-bone">Next up</h2></div>
        {nextBooking?.session ? (
          <div className="rounded-xl border border-iron bg-onyx p-4">
            <div className="mono text-xs font-semibold text-gold">
              {new Date(nextBooking.session.starts_at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}
            </div>
            <div className="mt-1 font-bold text-bone">{nextBooking.session.class?.name ?? "Class"}</div>
            <div className="text-xs text-ash">You&apos;re booked</div>
          </div>
        ) : (
          <div className="rounded-xl border border-iron bg-onyx p-4 text-center text-sm text-ash">No upcoming classes booked.</div>
        )}
      </section>

      {/* ---- Balance + docs to sign ---- */}
      {outstanding > 0 || docs.length > 0 ? (
        <section id="more" className="flex flex-col gap-2">
          {outstanding > 0 ? (
            <div className="flex items-center justify-between rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-sm">
              <span className="text-loss">Balance due</span><span className="mono font-bold text-loss">{formatMoney(outstanding)}</span>
            </div>
          ) : null}
          {docs.map((d) => (
            <form key={d.id} action={signMyDocument} className="flex items-center justify-between rounded-xl border border-gold-line bg-gold-dim px-4 py-3 text-sm">
              <span className="font-semibold text-bone">Sign your {d.kind}</span>
              <input type="hidden" name="id" value={d.id} />
              <button className="rounded-md bg-gold px-3 py-1 text-xs font-bold text-black">Sign</button>
            </form>
          ))}
        </section>
      ) : null}

      {/* ---- Bottom tab bar (PWA) ---- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center justify-around border-t border-iron bg-black/92 px-4 py-2 backdrop-blur">
        <TabLink href="#pass" label="Home" icon="⌂" active />
        <TabLink href="#book" label="Book" icon="◲" />
        <a href="#pass" className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-gold text-2xl text-black shadow-[0_0_20px_rgba(245,197,24,0.5)]">▢</a>
        <TabLink href="#more" label="Progress" icon="📈" />
        <TabLink href="#more" label="More" icon="☰" />
      </nav>
    </main>
  );
}

function Brand({ email }: { email: string }) {
  return (
    <div>
      <Link href="/" className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-gold"><Image src="/brand/luduzo_helmet.svg" alt="" width={18} height={18} /></span>
        <span className="font-display text-[15px] font-extrabold tracking-[0.18em] text-bone">LUDUZO</span>
      </Link>
      <p className="mt-2 text-xs text-ash">{email}</p>
    </div>
  );
}
function ErrBanner({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{children}</p>;
}
function TabLink({ href, label, icon, active = false }: { href: string; label: string; icon: string; active?: boolean }) {
  return (
    <a href={href} className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${active ? "text-gold" : "text-ash-dim"}`}>
      <span className="text-lg">{icon}</span>{label}
    </a>
  );
}
