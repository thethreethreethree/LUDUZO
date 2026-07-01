import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Booking = { id: string; status: string; session: { starts_at: string; class: { name: string } | null } | null };
type Appt = { id: string; title: string | null; starts_at: string; ends_at: string; status: string; trainer: { full_name: string | null } | null };

export default async function PortalBookPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase.from("members").select("id").eq("profile_id", user.id);
  const ids = ((memberData ?? []) as { id: string }[]).map((m) => m.id);
  if (ids.length === 0) redirect("/portal");

  const [{ data: bookingData }, { data: apptData }] = await Promise.all([
    supabase.from("bookings").select("id, status, session:class_sessions(starts_at, class:classes(name))").in("member_id", ids).order("created_at", { ascending: false }).limit(30),
    supabase.from("appointments").select("id, title, starts_at, ends_at, status, trainer:profiles(full_name)").in("member_id", ids).order("starts_at", { ascending: false }).limit(20),
  ]);

  const now = new Date().getTime();
  const bookings = ((bookingData ?? []) as unknown as Booking[]).filter((b) => b.session);
  const appts = (apptData ?? []) as unknown as Appt[];
  const upcoming = bookings.filter((b) => Date.parse(b.session!.starts_at) > now).sort((a, b) => Date.parse(a.session!.starts_at) - Date.parse(b.session!.starts_at));
  const past = bookings.filter((b) => Date.parse(b.session!.starts_at) <= now);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pb-28 pt-8">
      <h1 className="text-2xl font-extrabold text-bone">Classes &amp; bookings</h1>

      <section>
        <div className="mb-2 text-[15px] font-bold text-bone">Upcoming</div>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-iron bg-onyx p-4 text-sm text-ash">Nothing booked. Browse the schedule at the front desk or in-app soon.</div>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((b) => (
              <li key={b.id} className="rounded-2xl border border-iron bg-onyx p-4">
                <div className="mono text-xs font-semibold text-gold">{new Date(b.session!.starts_at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</div>
                <div className="mt-0.5 font-bold text-bone">{b.session!.class?.name ?? "Class"}</div>
                <div className="text-xs text-ash">{b.status === "waitlisted" ? "On the waitlist" : "You're booked"}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {appts.length > 0 ? (
        <section>
          <div className="mb-2 text-[15px] font-bold text-bone">Personal training</div>
          <ul className="flex flex-col gap-2">
            {appts.map((a) => (
              <li key={a.id} className="rounded-2xl border border-iron bg-onyx p-4">
                <div className="mono text-xs font-semibold text-gold">{new Date(a.starts_at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</div>
                <div className="mt-0.5 font-bold text-bone">{a.title ?? "PT session"}</div>
                <div className="text-xs text-ash">{a.trainer?.full_name ? `with ${a.trainer.full_name} · ` : ""}{a.status}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section>
          <div className="mb-2 text-[15px] font-bold text-bone">Past</div>
          <ul className="flex flex-col divide-y divide-iron rounded-2xl border border-iron bg-onyx">
            {past.slice(0, 8).map((b) => (
              <li key={b.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-bone">{b.session!.class?.name ?? "Class"}</span>
                <span className="mono text-xs text-ash-dim">{new Date(b.session!.starts_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="rounded-xl border border-dashed border-iron p-3 text-center text-xs text-ash-dim">
        Self-service class booking is coming — it needs a scheduled database update (currently queued).
      </p>
    </main>
  );
}
