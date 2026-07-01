import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { formatMoney } from "@/lib/billing";
import { rentLocker, endLockerRental } from "./actions";

export const dynamic = "force-dynamic";

type Rental = {
  id: string; locker_label: string; monthly_fee_cents: number; starts_on: string | null; ends_on: string | null; status: string;
  member: { first_name: string; last_name: string } | null;
};
type MemberOpt = { id: string; first_name: string; last_name: string };

export default async function LockersPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgs = await getWritableOrgs(supabase);
  const { data: rData } = await supabase
    .from("locker_rentals")
    .select("id, locker_label, monthly_fee_cents, starts_on, ends_on, status, member:members(first_name, last_name)")
    .order("locker_label").limit(300);
  const rentals = (rData ?? []) as unknown as Rental[];
  const { data: memberData } = await supabase.from("members").select("id, first_name, last_name").order("last_name").limit(500);
  const members = (memberData ?? []) as unknown as MemberOpt[];

  const active = rentals.filter((r) => r.status === "active");
  const mrr = active.reduce((s, r) => s + r.monthly_fee_cents, 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">← Dashboard</Link>
        <h1 className="mt-1 text-h1 text-bone">Locker rentals</h1>
        <p className="text-sm text-ash">{active.length} active · {formatMoney(mrr)}/mo.</p>
      </div>

      {error ? <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p> : null}

      {orgs.length > 0 ? (
        <form action={rentLocker} className="flex flex-wrap items-end gap-3 rounded-md border border-onyx bg-onyx p-5">
          <OrgPicker orgs={orgs} />
          <input name="locker_label" required placeholder="Locker #" className="w-24 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <select name="member_id" className="min-w-0 flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
            <option value="">— member —</option>
            {members.map((m) => (<option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>))}
          </select>
          <input name="monthly_fee" type="number" step="0.01" min="0" placeholder="$/mo" className="w-24 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <button className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Rent</button>
        </form>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Lockers</h2>
        {rentals.length === 0 ? (
          <p className="text-sm text-ash">No locker rentals.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx">
            {rentals.map((r) => (
              <li key={r.id} className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${r.status === "active" ? "" : "opacity-50"}`}>
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">Locker {r.locker_label}{r.member ? ` · ${r.member.first_name} ${r.member.last_name}` : " · vacant"}</span>
                  <span className="text-xs text-ash">{r.monthly_fee_cents ? `${formatMoney(r.monthly_fee_cents)}/mo · ` : ""}{r.status}</span>
                </div>
                {r.status === "active" ? (
                  <form action={endLockerRental}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-md border border-iron px-2 py-1 text-xs font-medium hover:border-gold hover:text-gold">End</button>
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
