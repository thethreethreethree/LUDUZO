import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bookSession, cancelBooking } from "../actions";

export const dynamic = "force-dynamic";

type Booking = { id: string; status: string; session: { id: string; starts_at: string; class: { name: string } | null } | null };
type Appt = { id: string; title: string | null; starts_at: string; ends_at: string; status: string; trainer_id: string | null };
type Session = { id: string; starts_at: string; ends_at: string | null; capacity: number | null; class_id: string; class: { name: string; description: string | null; capacity: number | null; instructor_name: string | null } | null };

const OK_MSG: Record<string, string> = {
  booked: "You're booked. See you there.",
  waitlisted: "That class was full — you're on the waitlist. We'll move you up if a spot opens.",
  cancelled: "Booking cancelled.",
};

export default async function PortalBookPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; instructor?: string; type?: string; level?: string }> }) {
  const { ok, error, instructor, type, level } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase.from("members").select("id, organization_id, organization:organizations(settings)").eq("profile_id", user.id);
  const members = ((memberData ?? []) as unknown as { id: string; organization_id: string; organization: { settings: { cancellation_policy?: string } | null } | null }[]);
  const ids = members.map((m) => m.id);
  if (ids.length === 0) redirect("/portal");
  const cancellationPolicy = members[0]?.organization?.settings?.cancellation_policy ?? null;

  const nowIso = new Date().toISOString();
  const [{ data: bookingData }, { data: apptData }, { data: sessionData }, { data: staffData }, { data: availData }, { data: tagData }] = await Promise.all([
    supabase.from("bookings").select("id, status, session:class_sessions(id, starts_at, class:classes(name))").in("member_id", ids).order("created_at", { ascending: false }).limit(30),
    // trainer_id (not a profiles embed): members can't read staff profiles, so the
    // embed returned null. Names come from gym_staff_directory (0040, name-only).
    supabase.from("appointments").select("id, title, starts_at, ends_at, status, trainer_id").in("member_id", ids).order("starts_at", { ascending: false }).limit(20),
    // Bookable schedule — readable by the member via 0034 (org-scoped). Upcoming only.
    supabase.from("class_sessions").select("id, starts_at, ends_at, capacity, class_id, class:classes(name, description, capacity, instructor_name)").gte("starts_at", nowIso).eq("status", "scheduled").order("starts_at", { ascending: true }).limit(40),
    supabase.from("gym_staff_directory").select("user_id, full_name"),
    supabase.from("class_session_availability").select("session_id, capacity, booked"),
    // §4 class type/difficulty tags — separate graceful query (pre-0056 → empty → no chips).
    supabase.from("classes").select("id, class_type, difficulty"),
  ]);

  const now = new Date().getTime();
  const allBookings = ((bookingData ?? []) as unknown as Booking[]);
  const appts = (apptData ?? []) as unknown as Appt[];
  const sessions = (sessionData ?? []) as unknown as Session[];
  const staffName = new Map(((staffData ?? []) as { user_id: string; full_name: string | null }[]).map((s) => [s.user_id, s.full_name]));
  // §4 availability (0054): session_id → spots left (capacity − booked). null capacity = unlimited.
  const spotsLeft = new Map<string, number | null>();
  for (const a of ((availData ?? []) as { session_id: string; capacity: number | null; booked: number }[])) {
    spotsLeft.set(a.session_id, a.capacity == null ? null : Math.max(0, a.capacity - a.booked));
  }
  const withSession = allBookings.filter((b) => b.session);
  // Bookings whose class detail is not member-readable — show them anyway (F1).
  const detailsPending = allBookings.filter((b) => !b.session && b.status !== "cancelled");
  const upcoming = withSession.filter((b) => Date.parse(b.session!.starts_at) > now && b.status !== "cancelled").sort((a, b) => Date.parse(a.session!.starts_at) - Date.parse(b.session!.starts_at));
  // "Past" = classes that actually happened for the member. Exclude cancelled /
  // still-waitlisted rows — showing a class they cancelled as history reads as if
  // they attended it (misleading).
  const past = withSession.filter((b) => Date.parse(b.session!.starts_at) <= now && (b.status === "booked" || b.status === "attended" || b.status === "no_show"));

  // Sessions the member already has an active booking for → show state, not a Book button.
  const bookedStatusBySession = new Map<string, string>();
  for (const b of withSession) {
    if (b.session && (b.status === "booked" || b.status === "waitlisted")) bookedStatusBySession.set(b.session.id, b.status);
  }

  // §4 waitlist position (0053) for the member's upcoming waitlisted bookings.
  // Graceful: if the function isn't applied, the rpc errors → no position shown.
  const waitPos = new Map<string, number>();
  await Promise.all(
    upcoming.filter((b) => b.status === "waitlisted" && b.session).map(async (b) => {
      const { data } = await supabase.rpc("my_waitlist_position", { p_session_id: b.session!.id });
      if (typeof data === "number" && data > 0) waitPos.set(b.id, data);
    }),
  );

  // §4: filter by instructor / type / difficulty + group the schedule by day.
  // Tags come from the separate graceful query (0056); empty → no type/level chips.
  const classTags = new Map(((tagData ?? []) as { id: string; class_type: string | null; difficulty: string | null }[]).map((c) => [c.id, c]));
  const typeOf = (s: Session) => classTags.get(s.class_id)?.class_type ?? null;
  const levelOf = (s: Session) => classTags.get(s.class_id)?.difficulty ?? null;
  const instructors = Array.from(new Set(sessions.map((s) => s.class?.instructor_name).filter(Boolean))) as string[];
  const types = Array.from(new Set(sessions.map(typeOf).filter(Boolean))) as string[];
  const levels = Array.from(new Set(sessions.map(levelOf).filter(Boolean))) as string[];
  const filteredSessions = sessions.filter((s) =>
    (!instructor || s.class?.instructor_name === instructor) &&
    (!type || typeOf(s) === type) &&
    (!level || levelOf(s) === level));
  // Build a filter URL preserving the other active filters.
  const filterHref = (o: { instructor?: string; type?: string; level?: string }) => {
    const cur = { instructor, type, level, ...o };
    const p = new URLSearchParams();
    if (cur.instructor) p.set("instructor", cur.instructor);
    if (cur.type) p.set("type", cur.type);
    if (cur.level) p.set("level", cur.level);
    const qs = p.toString();
    return "/portal/book" + (qs ? `?${qs}` : "");
  };
  const chip = (active: boolean) => `rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-gold text-black" : "border border-iron text-ash hover:text-gold"}`;
  const todayStr = new Date().toDateString();
  const tomorrowStr = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toDateString(); })();
  const dayLabel = (iso: string) => {
    const d = new Date(iso); const ds = d.toDateString();
    if (ds === todayStr) return "Today";
    if (ds === tomorrowStr) return "Tomorrow";
    return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  };
  const grouped: { label: string; items: Session[] }[] = [];
  for (const s of filteredSessions) {
    const label = dayLabel(s.starts_at);
    const g = grouped.find((x) => x.label === label);
    if (g) g.items.push(s); else grouped.push({ label, items: [s] });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pb-28 pt-8">
      <h1 className="text-2xl font-extrabold text-bone">Classes &amp; bookings</h1>

      {ok ? <p className="rounded-md border border-win/40 bg-win/10 px-3 py-2 text-sm text-win">{OK_MSG[ok] ?? "Done."}</p> : null}
      {error ? <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p> : null}

      {cancellationPolicy ? (
        <p className="rounded-xl border border-iron bg-onyx px-3 py-2 text-xs text-ash">ℹ {cancellationPolicy}</p>
      ) : null}

      {/* ---- Browse & book the schedule (grouped by day, filterable by trainer) ---- */}
      <section>
        <div className="mb-2 text-[15px] font-bold text-bone">Schedule</div>
        {(instructors.length > 1 || types.length > 0 || levels.length > 0) ? (
          <div className="mb-3 flex flex-col gap-1.5">
            {types.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                <Link href={filterHref({ type: undefined })} className={chip(!type)}>All types</Link>
                {types.map((t) => (<Link key={t} href={filterHref({ type: t })} className={chip(type === t)}>{t}</Link>))}
              </div>
            ) : null}
            {levels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                <Link href={filterHref({ level: undefined })} className={chip(!level)}>All levels</Link>
                {levels.map((l) => (<Link key={l} href={filterHref({ level: l })} className={chip(level === l)}>{l}</Link>))}
              </div>
            ) : null}
            {instructors.length > 1 ? (
              <div className="flex flex-wrap gap-1.5">
                <Link href={filterHref({ instructor: undefined })} className={chip(!instructor)}>All trainers</Link>
                {instructors.map((i) => (<Link key={i} href={filterHref({ instructor: i })} className={chip(instructor === i)}>{i}</Link>))}
              </div>
            ) : null}
          </div>
        ) : null}
        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-iron bg-onyx p-4 text-sm text-ash">No classes scheduled yet. Check back soon.</div>
        ) : filteredSessions.length === 0 ? (
          <div className="rounded-2xl border border-iron bg-onyx p-4 text-sm text-ash">No classes match that filter. <Link href="/portal/book" className="text-gold">Clear</Link></div>
        ) : (
          grouped.map((g) => (
            <div key={g.label} className="mb-3">
              <div className="mono mb-1.5 text-[11px] uppercase tracking-[0.07em] text-ash-dim">{g.label}</div>
              <ul className="flex flex-col gap-2">
                {g.items.map((s) => {
                  const mine = bookedStatusBySession.get(s.id);
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-iron bg-onyx p-4">
                      <div className="min-w-0">
                        <div className="mono text-xs font-semibold text-gold">{new Date(s.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
                        <div className="mt-0.5 truncate font-bold text-bone">{s.class?.name ?? "Class"}</div>
                        {(typeOf(s) || levelOf(s)) ? (
                          <div className="flex flex-wrap gap-1">
                            {typeOf(s) ? <span className="rounded bg-iron px-1.5 py-0.5 text-[10px] font-semibold text-ash">{typeOf(s)}</span> : null}
                            {levelOf(s) ? <span className="rounded bg-iron px-1.5 py-0.5 text-[10px] font-semibold text-ash">{levelOf(s)}</span> : null}
                          </div>
                        ) : null}
                        {s.class?.instructor_name ? <div className="truncate text-xs text-ash">with {s.class.instructor_name}</div> : null}
                        {(() => {
                          const left = spotsLeft.get(s.id);
                          if (left === undefined || left === null) return null;
                          return left === 0
                            ? <div className="text-xs font-semibold text-loss">Full · join the waitlist</div>
                            : <div className={`text-xs font-semibold ${left <= 3 ? "text-warn" : "text-ash"}`}>{left} spot{left === 1 ? "" : "s"} left</div>;
                        })()}
                        {s.class?.description ? <div className="mt-0.5 line-clamp-2 text-xs text-ash-dim">{s.class.description}</div> : null}
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
            </div>
          ))
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
                  <div className="text-xs text-ash">{b.status === "waitlisted" ? `On the waitlist${waitPos.get(b.id) ? ` · #${waitPos.get(b.id)} in line` : ""}` : "You're booked"}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {b.status === "booked" ? (
                    <a href={`/portal/calendar/${b.id}`} className="rounded-md border border-iron px-3 py-1.5 text-xs font-semibold text-ash hover:border-gold hover:text-gold">＋ Calendar</a>
                  ) : null}
                  <form action={cancelBooking}>
                    <input type="hidden" name="id" value={b.id} />
                    <button className="rounded-md border border-iron px-3 py-1.5 text-xs font-semibold text-ash hover:border-loss hover:text-loss">Cancel</button>
                  </form>
                </div>
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
                <div className="text-xs text-ash">{a.trainer_id && staffName.get(a.trainer_id) ? `with ${staffName.get(a.trainer_id)} · ` : ""}{a.status}</div>
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
