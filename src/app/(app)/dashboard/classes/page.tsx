import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { MANAGEMENT_ROLES } from "@/lib/billing";
import { OrgPicker } from "@/components/OrgPicker";
import { createClass, updateClass, createSession, createBooking, createRecurringSessions } from "./actions";

export const dynamic = "force-dynamic";

type ClassRow = { id: string; name: string; instructor_name: string | null; capacity: number | null; organization: { name: string } | null };
type SessionRow = {
  id: string;
  organization_id: string;
  starts_at: string;
  status: string;
  class: { name: string } | null;
};
type MemberOpt = { id: string; first_name: string; last_name: string };

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: classData } = await supabase
    .from("classes")
    .select("id, name, instructor_name, capacity, organization:organizations(name)")
    .order("name", { ascending: true });
  const classes = (classData ?? []) as unknown as ClassRow[];

  // Recent + upcoming sessions (hide anything older than yesterday).
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 1);
  cutoff.setHours(0, 0, 0, 0);
  const { data: sessionData } = await supabase
    .from("class_sessions")
    .select("id, organization_id, starts_at, status, class:classes(name)")
    .gte("starts_at", cutoff.toISOString())
    .order("starts_at", { ascending: true })
    .limit(200);
  const sessions = (sessionData ?? []) as unknown as SessionRow[];

  const { data: memberData } = await supabase
    .from("members")
    .select("id, first_name, last_name")
    .order("last_name", { ascending: true })
    .limit(500);
  const members = (memberData ?? []) as unknown as MemberOpt[];

  const mgmtOrgs = await getWritableOrgs(supabase, MANAGEMENT_ROLES);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-h1 text-bone">Classes & bookings</h1>
      </div>

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Classes</h2>
        {classes.length === 0 ? (
          <p className="text-sm text-ash">No classes yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
            {classes.map((c) => (
              <li key={c.id} className="px-4 py-3">
                {mgmtOrgs.length > 0 ? (
                  <form action={updateClass} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input name="name" defaultValue={c.name} className="flex-1 rounded-md border border-iron px-3 py-1.5 text-sm bg-onyx-2" />
                    <input name="instructor_name" defaultValue={c.instructor_name ?? ""} placeholder="Instructor" className="w-full rounded-md border border-iron px-3 py-1.5 text-sm bg-onyx-2" />
                    <input name="capacity" type="number" min="0" defaultValue={c.capacity ?? ""} placeholder="Cap" className="w-16 rounded-md border border-iron px-2 py-1.5 text-sm bg-onyx-2" />
                    <button className="rounded-md border border-iron px-3 py-1.5 text-xs font-medium hover:bg-onyx-2 hover:bg-onyx-2">
                      Save
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-ash">{c.instructor_name ?? ""}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {mgmtOrgs.length > 0 ? (
          <form action={createClass} className="mt-2 flex flex-wrap items-end gap-2">
            <OrgPicker orgs={mgmtOrgs} />
            <input name="name" required placeholder="Class name" className="flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            <input name="instructor_name" placeholder="Instructor" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            <input name="capacity" type="number" min="0" placeholder="Cap" className="w-20 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            <button className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
              Add class
            </button>
          </form>
        ) : null}
      </section>

      {classes.length > 0 && mgmtOrgs.length > 0 ? (
        <form action={createSession} className="flex flex-wrap items-end gap-2 rounded-md border border-onyx bg-onyx p-4">
          <h2 className="w-full text-sm font-medium">Schedule a session</h2>
          <OrgPicker orgs={mgmtOrgs} />
          <select name="class_id" required className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input name="starts_at" type="datetime-local" required className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <button className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
            Schedule
          </button>
        </form>
      ) : null}

      {classes.length > 0 && mgmtOrgs.length > 0 ? (
        <form action={createRecurringSessions} className="flex flex-wrap items-end gap-2 rounded-md border border-onyx bg-onyx p-4">
          <h2 className="w-full text-sm font-medium">Schedule a weekly series</h2>
          <OrgPicker orgs={mgmtOrgs} />
          <select name="class_id" required className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input name="starts_at" type="datetime-local" required className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <input name="count" type="number" min="1" max="52" defaultValue={8} className="w-20 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" title="Number of weeks" />
          <button className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
            Schedule weekly
          </button>
        </form>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-ash">No sessions scheduled.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-iron px-4 py-3">
                <Link href={`/dashboard/classes/${s.id}`} className="flex flex-col hover:underline">
                  <span className="font-medium">
                    {s.class?.name ?? "(class)"}
                    {s.status === "cancelled" ? (
                      <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                        cancelled
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-ash">{new Date(s.starts_at).toLocaleString()}</span>
                </Link>
                {members.length > 0 && s.status !== "cancelled" ? (
                  <form action={createBooking} className="flex items-center gap-2">
                    <input type="hidden" name="organization_id" value={s.organization_id} />
                    <input type="hidden" name="session_id" value={s.id} />
                    <select name="member_id" required className="rounded-md border border-iron px-2 py-1 text-xs bg-onyx-2">
                      <option value="">— member —</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.last_name}, {m.first_name}
                        </option>
                      ))}
                    </select>
                    <button className="rounded-md border border-iron px-3 py-1 text-xs font-medium hover:bg-onyx-2 hover:bg-onyx-2">
                      Book
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
