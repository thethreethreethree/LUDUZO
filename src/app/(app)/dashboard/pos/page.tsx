import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/billing";
import { recordSale } from "./actions";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  stock_quantity: number;
};

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("products")
    .select("id, name, price_cents, currency, stock_quantity")
    .eq("active", true)
    .order("name", { ascending: true });
  const products = (data ?? []) as unknown as ProductRow[];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Point of sale</h1>
        <p className="text-sm text-zinc-500">Records a paid invoice and decrements stock.</p>
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          Sale recorded.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-zinc-500 ">
          No products. Add some under Inventory.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {products.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-md border border-onyx bg-onyx px-4 py-3"
            >
              <span className="flex flex-col">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-zinc-500">
                  {formatMoney(p.price_cents, p.currency)} ·{" "}
                  <span className={p.stock_quantity <= 0 ? "font-medium text-red-500" : ""}>
                    {p.stock_quantity} in stock
                  </span>
                </span>
              </span>
              <form action={recordSale} className="flex items-center gap-2">
                <input type="hidden" name="product_id" value={p.id} />
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  defaultValue={1}
                  className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
                <button className="rounded-md bg-gold px-4 py-1.5 text-sm font-medium text-black hover:opacity-90">
                  Sell
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
