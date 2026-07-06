import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { formatMoney } from "@/lib/billing";
import { createAppointment, updateAppointmentStatus } from "./actions";
import { APPOINTMENT_STATUSES } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  price_cents: number;
  member: { first_name: string; last_name: string } | null;
  trainer: { full_name: string | null } | null;
};
type MemberOpt = { id: string; first_name: string; last_name: string };
type StaffOpt = { user_id: string; profile: { full_name: string | null } | null };

export default async function AppointmentsPage({
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

  const orgs = await getWritableOrgs(supabase);

  const { data: apptData } = await supabase
    .from("appointments")
    .select(
      "id, title, starts_at, ends_at, status, price_cents, member:members(first_name, last_name), trainer:profiles(full_name)",
    )
    .order("starts_at", { ascending: false })
    .limit(50);
  const appts = (apptData ?? []) as unknown as Row[];

  const { data: memberData } = await supabase
    .from("members")
    .select("id, first_name, last_name")
    .order("last_name", { ascending: true })
    .limit(500);
  const members = (memberData ?? []) as unknown as MemberOpt[];

  const { data: staffData } = await supabase
    .from("organization_members")
    .select("user_id, profile:profiles(full_name)")
    .limit(200);
  const staff = (staffData ?? []) as unknown as StaffOpt[];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-h1 text-bone">Appointments</h1>
        <p className="text-sm text-ash">Personal-training and 1:1 sessions.</p>
      </div>

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>
      ) : null}

      {orgs.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-ash">
          You don&apos;t manage any gym.
        </p>
      ) : (
        <form action={createAppointment} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-5">
          <OrgPicker orgs={orgs} />
          <div className="flex gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">Member</span>
              <select name="member_id" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
                <option value="">— none —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">Trainer</span>
              <select name="trainer_id" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
                <option value="">— none —</option>
                {staff.map((s) => (
                  <option key={s.user_id} value={s.user_id}>{s.profile?.full_name ?? "(staff)"}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Title (optional)</span>
            <input name="title" placeholder="e.g. Strength assessment" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          </label>
          <div className="flex gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">Starts</span>
              <input name="starts_at" type="datetime-local" required className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">Ends</span>
              <input name="ends_at" type="datetime-local" required className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">Price</span>
              <input name="price" type="number" step="0.01" min="0" placeholder="0.00" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            </label>
          </div>
          <button className="self-start rounded-md bg-gold px-4 py-2.5 text-sm font-medium text-black hover:opacity-90">
            Schedule appointment
          </button>
        </form>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Upcoming &amp; recent</h2>
        {appts.length === 0 ? (
          <p className="text-sm text-ash">No appointments yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx">
            {appts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">
                    {a.title ?? "Session"}
                    {a.member ? ` · ${a.member.first_name} ${a.member.last_name}` : ""}
                  </span>
                  <span className="text-xs text-ash">
                    {new Date(a.starts_at).toLocaleString()} → {new Date(a.ends_at).toLocaleTimeString()}
                    {a.trainer?.full_name ? ` · ${a.trainer.full_name}` : ""}
                    {a.price_cents ? ` · ${formatMoney(a.price_cents)}` : ""}
                  </span>
                </div>
                <form action={updateAppointmentStatus} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <select
                    name="status"
                    aria-label={`Status for ${a.title ?? "this appointment"}`}
                    defaultValue={a.status}
                    className="rounded-md border border-iron bg-transparent px-2 py-1 text-xs"
                  >
                    {APPOINTMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button className="rounded-md border border-iron px-2 py-1 text-xs font-medium hover:border-gold hover:text-gold">
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
