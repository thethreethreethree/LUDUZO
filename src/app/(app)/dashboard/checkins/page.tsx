import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatBlock, ProgressBar, Card, CardHeader, Avatar, btnGold } from "@/components/ui";
import { recordCheckin, checkoutCheckin } from "./actions";

export const dynamic = "force-dynamic";

type FeedRow = {
  id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  member: { first_name: string; last_name: string; member_number: string | null } | null;
};
type MemberOpt = { id: string; first_name: string; last_name: string };

export default async function CheckinsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayISO = startOfDay.toISOString();

  const [{ count: occupancy }, { count: todayCount }, { data: feedData }, { data: memberData }, { data: locData }, { count: guestCount }] =
    await Promise.all([
      supabase.from("checkins").select("id", { count: "exact", head: true }).is("checked_out_at", null),
      supabase.from("checkins").select("id", { count: "exact", head: true }).gte("checked_in_at", todayISO),
      supabase.from("checkins").select("id, checked_in_at, checked_out_at, member:members(first_name, last_name, member_number)").gte("checked_in_at", todayISO).order("checked_in_at", { ascending: false }).limit(25),
      supabase.from("members").select("id, first_name, last_name").order("last_name").limit(500),
      supabase.from("locations").select("capacity"),
      supabase.from("guest_passes").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
    ]);

  const feed = (feedData ?? []) as unknown as FeedRow[];
  const members = (memberData ?? []) as unknown as MemberOpt[];
  const capacity = ((locData ?? []) as { capacity: number | null }[]).reduce((s, l) => s + (l.capacity ?? 0), 0) || 60;
  const occ = occupancy ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-7 py-8">
      <div>
        <div className="mono text-xs text-ash-dim">
          <Link href="/dashboard" className="hover:text-gold">Home</Link> / Front desk
        </div>
        <h1 className="mt-1 text-h1 text-bone">Front desk</h1>
        <p className="mt-1 text-sm text-ash">Scan a member&apos;s Arena Pass, or check them in by name.</p>
      </div>

      {error ? <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Arena scanner */}
        <Card className="flex flex-col gap-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-gold">◈ Arena scanner</div>
          <div className="relative mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-lg border border-iron bg-black">
            <span className="absolute left-3 top-3 h-6 w-6 rounded-tl border-l-2 border-t-2 border-gold" />
            <span className="absolute right-3 top-3 h-6 w-6 rounded-tr border-r-2 border-t-2 border-gold" />
            <span className="absolute bottom-3 left-3 h-6 w-6 rounded-bl border-b-2 border-l-2 border-gold" />
            <span className="absolute bottom-3 right-3 h-6 w-6 rounded-br border-b-2 border-r-2 border-gold" />
            <span className="absolute left-4 right-4 h-0.5 animate-scanline bg-gold/70" style={{ top: "18%" }} />
            <span className="absolute inset-0 grid place-items-center text-2xl text-ash-dim">▢</span>
          </div>
          <p className="text-center text-xs text-ash-dim">Point the camera at the member&apos;s QR — or use manual check-in below.</p>
          <form action={recordCheckin} className="flex flex-col gap-2">
            <select name="member_id" className="w-full rounded-md border border-iron bg-onyx-2 px-3 py-2 text-sm text-bone">
              <option value="">Select member…</option>
              {members.map((m) => (<option key={m.id} value={m.id}>{m.last_name}, {m.first_name}</option>))}
            </select>
            <div className="flex gap-2">
              <input name="qr_token" placeholder="…or type member ID" className="mono min-w-0 flex-1 rounded-md border border-iron bg-onyx-2 px-3 py-2 text-sm text-bone placeholder:text-ash-dim" />
              <button className={btnGold}>Check in</button>
            </div>
          </form>
        </Card>

        {/* Stats + live feed */}
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatBlock label="In the arena now" value={occ} unit={`/ ${capacity}`}>
              <div className="mt-3"><ProgressBar pct={(occ / capacity) * 100} /></div>
            </StatBlock>
            <StatBlock label="Check-ins today" value={todayCount ?? 0} />
            <StatBlock label="Guest passes" value={guestCount ?? 0} />
          </div>

          <Card>
            <CardHeader title="Live check-ins" action="Export →" href="/dashboard/checkins/export" />
            {feed.length === 0 ? (
              <p className="py-6 text-center text-sm text-ash">No check-ins yet today. Scan a pass to get started.</p>
            ) : (
              <ul className="flex flex-col">
                {feed.map((c, i) => {
                  const nm = c.member ? `${c.member.first_name} ${c.member.last_name}` : "Member";
                  const inGym = !c.checked_out_at;
                  return (
                    <li key={c.id} className={`flex items-center gap-3 border-b border-iron py-3 last:border-0 ${i === 0 ? "-mx-2 rounded-md bg-gold-dim px-2" : ""}`}>
                      <Avatar name={nm} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-bone">{nm}</div>
                        <div className="mono text-[11px] text-ash-dim">{c.member?.member_number ? `${c.member.member_number} · ` : ""}{new Date(c.checked_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
                      </div>
                      {inGym ? (
                        <form action={checkoutCheckin} className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-win"><span className="h-[7px] w-[7px] rounded-full bg-win" />In</span>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="rounded-md border border-iron px-2 py-1 text-xs font-medium text-ash hover:border-gold hover:text-gold">Out</button>
                        </form>
                      ) : (
                        <span className="text-xs text-ash-dim">checked out</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
