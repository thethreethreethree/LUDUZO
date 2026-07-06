import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { recordReview, recordNps } from "./actions";

export const dynamic = "force-dynamic";

type Review = { id: string; rating: number; comment: string | null; created_at: string };
type Nps = { id: string; score: number; comment: string | null; created_at: string };
type MemberOpt = { id: string; first_name: string; last_name: string };

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgs = await getWritableOrgs(supabase);
  const { data: reviewData } = await supabase.from("reviews").select("id, rating, comment, created_at").order("created_at", { ascending: false }).limit(100);
  const reviews = (reviewData ?? []) as unknown as Review[];
  const { data: npsData } = await supabase.from("nps_responses").select("id, score, comment, created_at").order("created_at", { ascending: false }).limit(500);
  const nps = (npsData ?? []) as unknown as Nps[];
  // True totals for the headline count — never the capped row lengths (A24). The avg
  // rating / NPS below are intentionally over the recent window and disclosed as such.
  const [{ count: reviewsCount }, { count: npsCount }] = await Promise.all([
    supabase.from("reviews").select("id", { count: "exact", head: true }),
    supabase.from("nps_responses").select("id", { count: "exact", head: true }),
  ]);
  const responsesTotal = (reviewsCount ?? reviews.length) + (npsCount ?? nps.length);
  const { data: memberData } = await supabase.from("members").select("id, first_name, last_name").order("last_name").limit(500);
  const members = (memberData ?? []) as unknown as MemberOpt[];

  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "—";
  const promoters = nps.filter((n) => n.score >= 9).length;
  const detractors = nps.filter((n) => n.score <= 6).length;
  const npsScore = nps.length ? Math.round(((promoters - detractors) / nps.length) * 100) : null;

  const memberOptions = (
    <>
      <option value="">— anonymous —</option>
      {members.map((m) => (<option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>))}
    </>
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">← Dashboard</Link>
        <h1 className="mt-1 text-h1 text-bone">Reviews &amp; NPS</h1>
        <p className="text-sm text-ash">Member satisfaction at a glance.</p>
      </div>

      {error ? <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p> : null}

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-onyx bg-onyx p-4">
          <div className="text-xs text-ash">Avg rating</div>
          <div className="mt-1 font-display text-2xl font-extrabold">{avgRating}<span className="text-sm text-ash"> /5</span></div>
        </div>
        <div className="rounded-md border border-onyx bg-onyx p-4">
          <div className="text-xs text-ash">NPS</div>
          <div className="mt-1 font-display text-2xl font-extrabold text-gold">{npsScore ?? "—"}</div>
        </div>
        <div className="rounded-md border border-onyx bg-onyx p-4">
          <div className="text-xs text-ash">Responses</div>
          <div className="mt-1 font-display text-2xl font-extrabold">{responsesTotal.toLocaleString()}</div>
        </div>
      </div>
      {(reviewsCount != null && reviewsCount > reviews.length) || (npsCount != null && npsCount > nps.length) ? (
        <p className="-mt-3 text-xs text-ash">
          “Responses” is the all-time total; the average rating and NPS reflect the most recent{" "}
          {reviews.length.toLocaleString()} reviews and {nps.length.toLocaleString()} NPS responses.
        </p>
      ) : null}

      {orgs.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <form action={recordReview} className="flex flex-col gap-2 rounded-md border border-onyx bg-onyx p-4">
            <span className="text-sm font-medium">Log a review</span>
            <OrgPicker orgs={orgs} />
            <div className="flex gap-2">
              <select name="rating" aria-label="Star rating" required className="w-20 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
                {[5, 4, 3, 2, 1].map((n) => (<option key={n} value={n}>{n}★</option>))}
              </select>
              <select name="member_id" aria-label="Member (optional)" className="min-w-0 flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">{memberOptions}</select>
            </div>
            <input name="comment" aria-label="Comment (optional)" placeholder="Comment (optional)" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Save review</button>
          </form>

          <form action={recordNps} className="flex flex-col gap-2 rounded-md border border-onyx bg-onyx p-4">
            <span className="text-sm font-medium">Log NPS</span>
            <OrgPicker orgs={orgs} />
            <div className="flex gap-2">
              <select name="score" aria-label="NPS score" required className="w-20 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
                {Array.from({ length: 11 }, (_, i) => 10 - i).map((n) => (<option key={n} value={n}>{n}</option>))}
              </select>
              <select name="member_id" aria-label="Member (optional)" className="min-w-0 flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">{memberOptions}</select>
            </div>
            <input name="comment" aria-label="Comment (optional)" placeholder="Comment (optional)" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Save NPS</button>
          </form>
        </div>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Recent reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-ash">No reviews yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx">
            {reviews.slice(0, 20).map((r) => (
              <li key={r.id} className="px-4 py-2 text-sm">
                <span className="text-gold">{"★".repeat(r.rating)}</span>
                <span className="text-ash">{"★".repeat(5 - r.rating)}</span>
                {r.comment ? <span className="ml-2 text-ash">{r.comment}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
