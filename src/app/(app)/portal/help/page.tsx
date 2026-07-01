import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FAQ = [
  { q: "How do I check in?", a: "Open the Home tab and show your Arena Pass QR at the front desk scanner. That's your one-tap entry." },
  { q: "How do I book a class?", a: "Your booked classes and PT sessions appear under Book. In-app self-booking is rolling out — for now, book at the front desk." },
  { q: "Where do I see my plan and progress?", a: "Progress shows your assigned workout & nutrition plans, body metrics, badges and visit history." },
  { q: "How do I pay or check my balance?", a: "More → Membership shows your plan and days left; Payment history lists your invoices. Any balance due appears on Home." },
  { q: "How do streaks work?", a: "Your streak counts consecutive days with a check-in. Keep it alive on the Home tab." },
];

export default async function PortalHelpPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase.from("members").select("organization:organizations(name)").eq("profile_id", user.id).limit(1);
  const gymName = ((memberData ?? []) as unknown as { organization: { name: string } | null }[])[0]?.organization?.name ?? "your gym";

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
        <div className="mt-3 flex flex-col gap-2">
          <a href="tel:" className="rounded-xl border border-iron bg-onyx-2 px-4 py-2.5 text-sm font-semibold text-bone">📞 Call the front desk</a>
          <a href="mailto:" className="rounded-xl border border-iron bg-onyx-2 px-4 py-2.5 text-sm font-semibold text-bone">✉ Email the gym</a>
        </div>
        <p className="mt-2 text-[11px] text-ash-dim">Contact details are set by your gym in Settings (coming to your card soon).</p>
      </section>

      <p className="text-center text-[11px] text-ash-dim">Luduzo — run your gym like an arena.</p>
    </main>
  );
}
