import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { addSupplier, logMaintenance, completeMaintenance } from "./actions";

export const dynamic = "force-dynamic";

type Maint = {
  id: string; kind: string; scheduled_for: string | null; completed_at: string | null; down: boolean; notes: string | null;
  equipment: { name: string } | null;
};
type Supplier = { id: string; name: string; contact_name: string | null; email: string | null; phone: string | null };
type EquipOpt = { id: string; name: string };

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgs = await getWritableOrgs(supabase);
  const { data: mData } = await supabase
    .from("equipment_maintenance")
    .select("id, kind, scheduled_for, completed_at, down, notes, equipment:equipment(name)")
    .order("created_at", { ascending: false }).limit(100);
  const records = (mData ?? []) as unknown as Maint[];
  const { data: sData } = await supabase.from("suppliers").select("id, name, contact_name, email, phone").order("name").limit(100);
  const suppliers = (sData ?? []) as unknown as Supplier[];
  const { data: eData } = await supabase.from("equipment").select("id, name").order("name").limit(500);
  const equipment = (eData ?? []) as unknown as EquipOpt[];

  const down = records.filter((r) => r.down && !r.completed_at);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">← Dashboard</Link>
        <h1 className="mt-1 text-h1 text-bone">Maintenance &amp; suppliers</h1>
        <p className="text-sm text-ash">{down.length > 0 ? `${down.length} item(s) currently down. ` : ""}Keep equipment serviced.</p>
      </div>

      {error ? <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p> : null}

      {orgs.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <form action={logMaintenance} className="flex flex-col gap-2 rounded-md border border-onyx bg-onyx p-4">
            <span className="text-sm font-medium">Log maintenance</span>
            <OrgPicker orgs={orgs} />
            <select name="equipment_id" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
              <option value="">— general —</option>
              {equipment.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
            </select>
            <div className="flex gap-2">
              <select name="kind" className="w-28 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
                <option value="service">service</option><option value="repair">repair</option><option value="inspection">inspection</option>
              </select>
              <input name="scheduled_for" type="date" className="min-w-0 flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            </div>
            <label className="flex items-center gap-2 text-xs text-ash"><input type="checkbox" name="down" /> mark out of service</label>
            <input name="notes" placeholder="Notes" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Log</button>
          </form>

          <form action={addSupplier} className="flex flex-col gap-2 rounded-md border border-onyx bg-onyx p-4">
            <span className="text-sm font-medium">Add supplier</span>
            <OrgPicker orgs={orgs} />
            <input name="name" required placeholder="Supplier name" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            <input name="contact_name" placeholder="Contact" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            <div className="flex gap-2">
              <input name="email" type="email" placeholder="Email" className="min-w-0 flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
              <input name="phone" placeholder="Phone" className="w-28 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            </div>
            <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Add</button>
          </form>
        </div>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Maintenance log</h2>
        {records.length === 0 ? (
          <p className="text-sm text-ash">No records.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx">
            {records.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">{r.equipment?.name ?? "General"} · {r.kind}
                    {r.down && !r.completed_at ? <span className="ml-2 text-loss">DOWN</span> : null}
                  </span>
                  <span className="text-xs text-ash">
                    {r.completed_at ? `done ${r.completed_at}` : r.scheduled_for ? `scheduled ${r.scheduled_for}` : "logged"}
                    {r.notes ? ` · ${r.notes}` : ""}
                  </span>
                </div>
                {!r.completed_at ? (
                  <form action={completeMaintenance}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-md border border-iron px-2 py-1 text-xs font-medium hover:border-gold hover:text-gold">Complete</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Suppliers ({suppliers.length})</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {suppliers.map((s) => (
            <li key={s.id} className="rounded-md border border-onyx bg-onyx px-4 py-2 text-sm">
              <span className="font-medium">{s.name}</span>
              <span className="block text-xs text-ash">{[s.contact_name, s.email, s.phone].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
          {suppliers.length === 0 ? <li className="text-sm text-ash">No suppliers.</li> : null}
        </ul>
      </section>
    </main>
  );
}
