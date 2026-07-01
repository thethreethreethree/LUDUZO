import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { MANAGEMENT_ROLES, formatMoney } from "@/lib/billing";
import { OrgPicker } from "@/components/OrgPicker";
import { createProduct, createEquipment, updateEquipmentStatus, adjustStock, toggleProductActive } from "./actions";

export const dynamic = "force-dynamic";

type ProductRow = { id: string; name: string; price_cents: number; currency: string; stock_quantity: number; active: boolean };
type EquipmentRow = { id: string; name: string; status: string };

const EQUIPMENT_STATUSES = ["operational", "maintenance", "retired"];

export default async function InventoryPage({
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

  const { data: prodData } = await supabase
    .from("products")
    .select("id, name, price_cents, currency, stock_quantity, active")
    .order("name", { ascending: true })
    .limit(300);
  const products = (prodData ?? []) as unknown as ProductRow[];

  const { data: equipData } = await supabase
    .from("equipment")
    .select("id, name, status")
    .order("name", { ascending: true })
    .limit(300);
  const equipment = (equipData ?? []) as unknown as EquipmentRow[];

  const orgs = await getWritableOrgs(supabase, MANAGEMENT_ROLES);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Inventory & equipment</h1>
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-zinc-500">Products</h2>
        {products.length === 0 ? (
          <p className="text-sm text-zinc-500">No products yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex flex-col">
                  <span className="flex items-center gap-2 font-medium">
                    {p.name}
                    {p.stock_quantity <= 5 ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        low stock
                      </span>
                    ) : null}
                    {!p.active ? (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800">
                        inactive
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-zinc-500">{formatMoney(p.price_cents, p.currency)}</span>
                </span>
                {orgs.length > 0 ? (
                  <form action={adjustStock} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <input
                      name="stock_quantity"
                      type="number"
                      min="0"
                      defaultValue={p.stock_quantity}
                      className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    <button className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                      Set
                    </button>
                    <button
                      formAction={toggleProductActive}
                      name="active"
                      value={String(p.active)}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      {p.active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-zinc-500">{p.stock_quantity} in stock</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {orgs.length > 0 ? (
          <form action={createProduct} className="mt-2 flex flex-wrap items-end gap-2">
            <OrgPicker orgs={orgs} />
            <input name="name" required placeholder="Product" className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
            <input name="sku" placeholder="SKU" className="w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
            <input name="price" type="number" min="0" step="0.01" placeholder="Price" className="w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
            <input name="stock" type="number" min="0" placeholder="Stock" className="w-20 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
            <button className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
              Add
            </button>
          </form>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-zinc-500">Equipment</h2>
        {equipment.length === 0 ? (
          <p className="text-sm text-zinc-500">No equipment yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
            {equipment.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium">{e.name}</span>
                {orgs.length > 0 ? (
                  <form action={updateEquipmentStatus} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={e.id} />
                    <select
                      name="status"
                      defaultValue={e.status}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      {EQUIPMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                      Save
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-zinc-500">{e.status}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {orgs.length > 0 ? (
          <form action={createEquipment} className="mt-2 flex flex-wrap items-end gap-2">
            <OrgPicker orgs={orgs} />
            <input name="name" required placeholder="Equipment" className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
            <input name="purchased_at" type="date" title="Purchased" className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
            <select name="status" className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              {EQUIPMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
              Add
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
