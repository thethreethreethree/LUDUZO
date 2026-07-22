import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { createBadge, awardBadge, createChallenge, createReward } from "./actions";

export const dynamic = "force-dynamic";

type Badge = { id: string; name: string; icon: string | null; description: string | null };
type Challenge = { id: string; name: string; goal_target: number | null; starts_on: string | null; ends_on: string | null };
type MemberOpt = { id: string; first_name: string; last_name: string };

export default async function GamificationPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // PERF: orgs + these four reads are mutually independent — one parallel wave instead
  // of five serial round-trips. A5-verified: nothing consumes another's result (the
  // leaderboard is derived below from members + checkinRows). A14: identical queries + casts.
  const [orgs, badges, challenges, members, checkinRows] = await Promise.all([
    getWritableOrgs(supabase),
    supabase.from("badges").select("id, name, icon, description").order("name").then((r) => (r.data ?? []) as unknown as Badge[]),
    supabase.from("challenges").select("id, name, goal_target, starts_on, ends_on").order("created_at", { ascending: false }).then((r) => (r.data ?? []) as unknown as Challenge[]),
    supabase.from("members").select("id, first_name, last_name").order("last_name").limit(500).then((r) => (r.data ?? []) as unknown as MemberOpt[]),
    supabase.from("checkins").select("member_id").limit(5000).then((r) => (r.data ?? []) as { member_id: string }[]),
  ]);

  // Derived leaderboard: top members by lifetime check-in count (honest heuristic, not "AI").
  const counts = new Map<string, number>();
  for (const r of checkinRows) counts.set(r.member_id, (counts.get(r.member_id) ?? 0) + 1);
  const nameById = new Map(members.map((m) => [m.id, `${m.first_name} ${m.last_name}`]));
  const leaderboard = [...counts.entries()]
    .map(([id, n]) => ({ name: nameById.get(id) ?? "(member)", n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">← Dashboard</Link>
        <h1 className="mt-1 text-h1 text-bone">Gamification</h1>
        <p className="text-sm text-ash">Badges, challenges, and a check-in leaderboard.</p>
      </div>

      {error ? <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p> : null}
      {ok ? <p className="rounded-md border border-l-2 border-onyx border-l-gold px-3 py-2 text-sm text-gold">{ok}</p> : null}

      {orgs.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <form action={createBadge} className="flex flex-col gap-2 rounded-md border border-onyx bg-onyx p-5">
            <span className="text-sm font-medium">New badge</span>
            <OrgPicker orgs={orgs} />
            <div className="flex gap-2">
              <input name="icon" aria-label="Badge icon" placeholder="🏅" className="w-16 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
              <input name="name" aria-label="Badge name" required placeholder="Badge name" className="w-full min-w-0 flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            </div>
            <input name="description" aria-label="Description" placeholder="Description (optional)" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Add badge</button>
          </form>

          <form action={awardBadge} className="flex flex-col gap-2 rounded-md border border-onyx bg-onyx p-5">
            <span className="text-sm font-medium">Award a badge</span>
            <OrgPicker orgs={orgs} />
            <select name="badge_id" aria-label="Badge to award" required className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
              <option value="">Badge…</option>
              {badges.map((b) => (<option key={b.id} value={b.id}>{b.icon ? `${b.icon} ` : ""}{b.name}</option>))}
            </select>
            <select name="member_id" aria-label="Member to award" required className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
              <option value="">Member…</option>
              {members.map((m) => (<option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>))}
            </select>
            <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Award</button>
          </form>
        </div>
      ) : null}

      {orgs.length > 0 ? (
        <form action={createChallenge} className="flex flex-col gap-2 rounded-md border border-onyx bg-onyx p-5">
          <span className="text-sm font-medium">New challenge</span>
          <OrgPicker orgs={orgs} />
          <div className="flex gap-2">
            <input name="name" aria-label="Challenge name" required placeholder="e.g. 20 visits in March" className="w-full min-w-0 flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            <input name="goal_target" aria-label="Challenge goal" type="number" min="1" placeholder="Goal" className="w-24 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          </div>
          <div className="flex gap-2">
            <input name="starts_on" aria-label="Challenge start date" type="date" className="w-full min-w-0 flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            <input name="ends_on" aria-label="Challenge end date" type="date" className="w-full min-w-0 flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          </div>
          <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Create challenge</button>
        </form>
      ) : null}

      {orgs.length > 0 ? (
        <form action={createReward} className="flex flex-col gap-2 rounded-md border border-onyx bg-onyx p-5">
          <span className="text-sm font-medium">New reward (members redeem points for it)</span>
          <OrgPicker orgs={orgs} />
          <div className="flex gap-2">
            <input name="name" aria-label="Reward name" required placeholder="e.g. Free smoothie" className="w-full min-w-0 flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            <input name="cost_points" aria-label="Reward cost in points" type="number" min="1" required placeholder="Cost (pts)" className="w-28 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          </div>
          <input name="description" aria-label="Reward description" placeholder="Description (optional)" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Create reward</button>
        </form>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-ash">Leaderboard · check-ins</h2>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-ash">No check-ins yet.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-onyx rounded-md border border-onyx">
              {leaderboard.map((l, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span><span className="text-gold">{i + 1}.</span> {l.name}</span>
                  <span className="text-xs text-ash">{l.n} visits</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-ash">Badges &amp; challenges</h2>
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <span key={b.id} className="rounded-full border border-iron px-3 py-1 text-xs">{b.icon ? `${b.icon} ` : ""}{b.name}</span>
            ))}
            {badges.length === 0 ? <span className="text-sm text-ash">No badges yet.</span> : null}
          </div>
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {challenges.map((c) => (
              <li key={c.id} className="rounded-md border border-onyx bg-onyx px-3 py-2">
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-ash">{c.goal_target ? ` · goal ${c.goal_target}` : ""}{c.ends_on ? ` · ends ${c.ends_on}` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
