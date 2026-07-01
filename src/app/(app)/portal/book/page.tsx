import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bookSession, cancelBooking } from "../actions";

export const dynamic = "force-dynamic";

type Booking = { id: string; status: string; session: { id: string; starts_at: string; class: { name: string } | null } | null };
type Appt = { id: string; title: string | null; starts_at: string; ends_at: string; status: string; trainer: { full_name: string | null } | null };
type Session = { id: string; starts_at: string; ends_at: string | null; capacity: number | null; class: { name: string; capacity: number | null; instructor_name: string | null } | null };

const OK_MSG: Record<string, string> = {
  booked: "You're booked. See you there.",
  waitlisted: "That class was full — you're on the waitlist. We'll move you up if a spot opens.",
  cancelled: "Booking cancelled.",
};

export default async function PortalBookPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase.from("members").select("id, organization_id").eq("profile_id", user.id);
  const members = ((memberData ?? []) as { id: string; organization_id: string }[]);
  const ids = members.map((m) => m.id);
  if (ids.length === 0) redirect("/portal");

  const nowIso = new Date().toISOString();
  const [{ data: bookingData }, { data: apptData }, { data: sessionData }] = await Promise.all([
    supabase.from("bookings").select("id, status, session:class_sessions(id, starts_at, class:classes(name))").in("member_id", ids).order("created_at", { ascending: false }).limit(30),
    supabase.from("appointments").select("id, title, starts_at, ends_at, status, trainer:profiles(full_name)").in("member_id", ids).order("starts_at", { ascending: false }).limit(20),
    // Bookable schedule — readable by the member via 0034 (org-scoped). Upcoming only.
    supabase.from("class_sessions").select("id, starts_at, ends_at, capacity, class:classes(name, capacity, instructor_name)").gte("starts_at", nowIso).eq("status", "scheduled").order("starts_at", { ascending: true }).limit(40),
  ]);

  const now = new Date().getTime();
  const allBookings = ((bookingData ?? []) as unknown as Booking[]);
  const appts = (apptData ?? []) as unknown as Appt[];
  const sessions = (sessionData ?? []) as unknown as Session[];
  const withSession = allBookings.filter((b) => b.session);
  // Bookings whose class detail is not member-readable — show them anyway (F1).
  const detailsPending = allBookings.filter((b) => !b.session && b.status !== "cancelled");
  const upcoming = withSession.filter((b) => Date.parse(b.session!.starts_at) > now && b.status !== "cancelled").sort((a, b) => Date.parse(a.session!.starts_at) - Date.parse(b.session!.starts_at));
  const past = withSession.filter((b) => Date.parse(b.session!.starts_at) <= now);

  // Sessions the member already has an active booking for → show state, not a Book button.
  const bookedStatusBySession = new Map<string, string>();
  for (const b of withSession) {
    if (b.session && (b.status === "booked" || b.status === "waitlisted")) bookedStatusBySession.set(b.session.id, b.status);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pb-28 pt-8">
      <h1 className="text-2xl font-extrabold text-bone">Classes &amp; bookings</h1>

      {ok ? <p className="rounded-md border border-win/40 bg-win/10 px-3 py-2 text-sm text-win">{OK_MSG[ok] ?? "Done."}</p> : null}
      {error ? <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p> : null}

      {/* ---- Browse & book the schedule ---- */}
      <section>
        <div className="mb-2 text-[15px] font-bold text-bone">This week&apos;s schedule</div>
        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-iron bg-onyx p-4 text-sm text-ash">No classes scheduled yet. Check back soon.</div>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => {
              const mine = bookedStatusBySession.get(s.id);
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-iron bg-onyx p-4">
                  <div className="min-w-0">
                    <div className="mono text-xs font-semibold text-gold">{new Date(s.starts_at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</div>
                    <div className="mt-0.5 truncate font-bold text-bone">{s.class?.name ?? "Class"}</div>
                    {s.class?.instructor_name ? <div className="truncate text-xs text-ash">with {s.class.instructor_name}</div> : null}
                  </div>
                  {mine === "booked" ? (
                    <span className="shrink-0 rounded-md bg-win/15 px-3 py-1.5 text-xs font-bold text-win">Booked ✓</span>
                  ) : mine === "waitlisted" ? (
                    <span className="shrink-0 rounded-md bg-warn/15 px-3 py-1.5 text-xs font-bold text-warn">Waitlisted</span>
                  ) : (
                    <form action={bookSession} className="shrink-0">
                      <input type="hidden" name="session_id" value={s.id} />
                      <button className="rounded-md bg-gold px-4 py-1.5 text-xs font-bold text-black hover:brightness-110">Book</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- Your upcoming bookings (with cancel) ---- */}
      <section>
        <div className="mb-2 text-[15px] font-bold text-bone">Your upcoming</div>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-iron bg-onyx p-4 text-sm text-ash">Nothing booked yet — pick a class above.</div>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 rounded-2xl border border-iron bg-onyx p-4">
                <div className="min-w-0">
                  <div className="mono text-xs font-semibold text-gold">{new Date(b.session!.starts_at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</div>
                  <div className="mt-0.5 truncate font-bold text-bone">{b.session!.class?.name ?? "Class"}</div>
                  <div className="text-xs text-ash">{b.status === "waitlisted" ? "On the waitlist" : "You're booked"}</div>
                </div>
                <form action={cancelBooking} className="shrink-0">
                  <input type="hidden" name="id" value={b.id} />
                  <button className="rounded-md border border-iron px-3 py-1.5 text-xs font-semibold text-ash hover:border-loss hover:text-loss">Cancel</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detailsPending.length > 0 ? (
        <section>
          <div className="mb-2 text-[15px] font-bold text-bone">Booked</div>
          <ul className="flex flex-col gap-2">
            {detailsPending.map((b) => (
              <li key={b.id} className="rounded-2xl border border-iron bg-onyx p-4">
                <div className="font-bold text-bone">Class booked</div>
                <div className="text-xs text-ash">{b.status === "waitlisted" ? "On the waitlist" : "You're booked"} · class details syncing</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
    </main>
  );
}
