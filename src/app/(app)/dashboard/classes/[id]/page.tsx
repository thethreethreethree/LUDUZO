import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateBookingStatus, cancelSession } from "../actions";

export const dynamic = "force-dynamic";

const BOOKING_STATUSES = ["booked", "waitlisted", "attended", "cancelled", "no_show"];

type Session = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  status: string;
  class: { name: string; capacity: number | null } | null;
};

type Booking = {
  id: string;
  status: string;
  member: { first_name: string; last_name: string } | null;
};

export default async function SessionRosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sessionData } = await supabase
    .from("class_sessions")
    .select("id, starts_at, ends_at, capacity, status, class:classes(name, capacity)")
    .eq("id", id)
    .maybeSingle();
  const session = sessionData as unknown as Session | null;

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-8">
        <Link href="/dashboard/classes" className="text-sm text-ash hover:underline">
          ← Classes
        </Link>
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-ash ">
          Session not found (or not in your gym).
        </p>
      </main>
    );
  }

  const { data: bookingData } = await supabase
    .from("bookings")
    .select("id, status, member:members(first_name, last_name)")
    .eq("session_id", id)
    .order("created_at", { ascending: true })
    .limit(500);
  const bookings = (bookingData ?? []) as unknown as Booking[];

  const cap = session.capacity ?? session.class?.capacity ?? null;
  const active = bookings.filter((b) => b.status === "booked" || b.status === "attended").length;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard/classes" className="text-sm text-ash hover:underline">
          ← Classes
        </Link>
        <h1 className="mt-1 text-h1 text-bone">
          {session.class?.name ?? "Session"}
        </h1>
        <p className="text-sm text-ash">
          {new Date(session.starts_at).toLocaleString()} · {active}
          {cap != null ? ` / ${cap}` : ""} booked · {session.status}
        </p>
        {session.status !== "cancelled" ? (
          <form action={cancelSession} className="mt-2">
            <input type="hidden" name="id" value={session.id} />
            <button className="rounded-md border border-iron px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">
              Cancel session
            </button>
          </form>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Roster</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-ash">No bookings yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium">
                  {b.member ? `${b.member.first_name} ${b.member.last_name}` : "(member)"}
                </span>
                <form action={updateBookingStatus} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="session_id" value={session.id} />
                  <select
                    name="status"
                    aria-label="Booking status"
                    defaultValue={b.status}
                    className="rounded-md border border-iron px-2 py-1 text-xs bg-onyx-2"
                  >
                    {BOOKING_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-md border border-iron px-2 py-1 text-xs font-medium hover:bg-onyx-2 hover:bg-onyx-2">
                    Save
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
