import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { SubmitButton } from "@/components/SubmitButton";
import { submitFeedback } from "../actions";

export const dynamic = "force-dynamic";

const FAQ = [
  { q: "How do I check in?", a: "Open the Home tab and show your Arena Pass QR at the front desk scanner. That's your one-tap entry." },
  { q: "How do I book a class?", a: "Open Book to see this week's schedule and tap Book on any class. If it's full you'll be added to the waitlist and moved up automatically when a spot opens. Your booked classes and PT sessions are listed under Book, and you can cancel there too." },
  { q: "Where do I see my plan and progress?", a: "Progress shows your assigned workout & nutrition plans, body metrics, badges and visit history. You can log your own weight/body-fat/muscle and join gym challenges right from Progress." },
  { q: "How do I pay or check my balance?", a: "More → Membership shows your plan and days left; Payment history lists your invoices. Any balance due appears on Home." },
  { q: "How do streaks work?", a: "Your streak counts consecutive days with a check-in. Keep it alive on the Home tab." },
];

export default async function PortalHelpPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase.from("members").select("organization:organizations(name, settings)").eq("profile_id", user.id).limit(1);
  const org = ((memberData ?? []) as unknown as { organization: { name: string; settings: { phone?: string; address?: string; hours?: string; amenities?: string } | null } | null }[])[0]?.organization ?? null;
  const gymName = org?.name ?? "your gym";
  const gymPhone = org?.settings?.phone ?? null;

  // §6 "meet the team" — gym staff via the directory. select("*") so a missing
  // `role` column (before 0052) degrades gracefully (the view holds no PII).
  const { data: staffData } = await supabase.from("gym_staff_directory").select("*");
  const team = ((staffData ?? []) as { user_id: string; full_name: string | null; role?: string; specialties?: string | null; bio?: string | null }[]).filter((s) => s.full_name);
  // Audit Finding 1 (A20 safe default): show only member-facing roles; owner/admin/
  // manager render as just a name (don't expose the gym's internal hierarchy).
  // Founder can override to show all roles.
  const roleLabel = (r?: string) => (({ trainer: "Trainer", coach: "Coach", front_desk: "Front desk" } as Record<string, string>)[r ?? ""] ?? "");
  const gymAddress = org?.settings?.address ?? null;
  const gymHours = org?.settings?.hours ?? null;
  const gymAmenities = org?.settings?.amenities ?? null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pb-28 pt-8">
      <div>
        <Link href="/portal/more" className="text-xs text-ash hover:text-gold">← More</Link>
        <h1 className="mt-1 text-2xl font-extrabold text-bone">Help &amp; info</h1>
      </div>

      <section>
        <div className="mb-2 text-[15px] font-bold text-bone">Frequently asked</div>
        <div className="flex flex-col gap-2">
          {FAQ.map((f, i) => (
            <details key={i} className="rounded-2xl border border-iron bg-onyx p-4 [&_summary]:cursor-pointer">
              <summary className="text-sm font-semibold text-bone">{f.q}</summary>
              <p className="mt-2 text-sm text-ash">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-iron bg-onyx p-4">
        <div className="text-[15px] font-bold text-bone">Contact {gymName}</div>
        <p className="mt-1 text-sm text-ash">Reach the team at the front desk during opening hours, or send feedback below.</p>
        {gymPhone ? (
          <div className="mt-3">
            <a href={`tel:${gymPhone.replace(/\s+/g, "")}`} className="flex items-center justify-center gap-1.5 rounded-xl border border-iron bg-onyx-2 px-4 py-2.5 text-center text-sm font-semibold text-bone hover:border-gold"><Icon name="call" size={15} /> Call the front desk · {gymPhone}</a>
          </div>
        ) : null}
        {(gymAddress || gymHours || gymAmenities) ? (
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            {gymHours ? (<div><dt className="text-[11px] uppercase tracking-[0.07em] text-ash-dim">Hours</dt><dd className="flex items-center gap-1.5 text-bone"><Icon name="hours" size={13} /> {gymHours}</dd></div>) : null}
            {gymAddress ? (<div><dt className="text-[11px] uppercase tracking-[0.07em] text-ash-dim">Location</dt><dd className="flex items-center gap-1.5 text-bone"><Icon name="location" size={13} /> <a href={`https://maps.google.com/?q=${encodeURIComponent(gymAddress)}`} target="_blank" rel="noopener noreferrer" className="hover:text-gold">{gymAddress}</a></dd></div>) : null}
            {gymAmenities ? (<div><dt className="text-[11px] uppercase tracking-[0.07em] text-ash-dim">Amenities</dt><dd className="flex items-center gap-1.5 text-bone"><Icon name="amenities" size={13} /> {gymAmenities}</dd></div>) : null}
          </dl>
        ) : null}
        {!gymPhone && !gymAddress && !gymHours && !gymAmenities ? (
          <p className="mt-2 text-[11px] text-ash-dim">Your gym hasn&apos;t added contact details yet.</p>
        ) : null}
      </section>

      {/* §6 meet the team (name/role/specialties/bio via gym_staff_directory) */}
      {team.length > 0 ? (
        <section className="rounded-2xl border border-iron bg-onyx p-4">
          <div className="text-[15px] font-bold text-bone">Meet the team</div>
          <ul className="mt-3 flex flex-col gap-3">
            {team.map((s) => (
              <li key={s.user_id} className="flex items-start gap-3">
                <Avatar name={s.full_name ?? "Coach"} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-bone">{s.full_name}{roleLabel(s.role) ? <span className="ml-1.5 text-[11px] font-normal text-ash-dim">· {roleLabel(s.role)}</span> : null}</div>
                  {s.specialties ? <div className="text-xs text-gold">{s.specialties}</div> : null}
                  {s.bio ? <p className="mt-0.5 text-xs text-ash">{s.bio}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Feedback / report — functional now (member-insert RLS live) */}
      <section className="rounded-2xl border border-iron bg-onyx p-4">
        <div className="text-[15px] font-bold text-bone">Share feedback</div>
        <p className="mt-1 text-sm text-ash">How likely are you to recommend {gymName}? (0–10)</p>
        {ok ? <p className="mt-2 rounded-md border border-win/40 bg-win/10 px-3 py-2 text-sm text-win">Thanks — feedback sent.</p> : null}
        {error ? <p className="mt-2 rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p> : null}
        <form action={submitFeedback} className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 11 }, (_, i) => i).map((n) => (
              <label key={n} className="cursor-pointer">
                <input type="radio" name="score" value={n} required className="peer sr-only" />
                <span className="mono grid h-8 w-8 place-items-center rounded-lg border border-iron text-sm text-ash peer-checked:border-gold peer-checked:bg-gold peer-checked:text-black">{n}</span>
              </label>
            ))}
          </div>
          <textarea name="comment" rows={2} placeholder="Anything else? (optional)" className="w-full rounded-md border border-iron bg-onyx-2 px-3 py-2 text-sm text-bone placeholder:text-ash-dim" />
          <SubmitButton className="self-start rounded-xl bg-gold px-4 py-2 text-sm font-bold text-black" pendingLabel="Sending…">Send feedback</SubmitButton>
        </form>
      </section>

      <p className="text-center text-[11px] text-ash-dim">{gymName}</p>
    </main>
  );
}
