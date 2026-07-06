import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { MANAGEMENT_ROLES, formatMoney } from "@/lib/billing";
import { OrgPicker } from "@/components/OrgPicker";
import { createCoupon, toggleCouponActive } from "./actions";

export const dynamic = "force-dynamic";

const DISCOUNT_TYPES = ["percent", "amount"];

type CouponRow = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  currency: string;
  active: boolean;
  organization: { name: string } | null;
};

function describeDiscount(c: CouponRow): string {
  return c.discount_type === "percent"
    ? `${c.discount_value}% off`
    : `${formatMoney(c.discount_value, c.currency)} off`;
}

export default async function CouponsPage({
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

  const { data } = await supabase
    .from("coupons")
    .select("id, code, discount_type, discount_value, currency, active, organization:organizations(name)")
    .order("code", { ascending: true })
    .limit(200);
  const coupons = (data ?? []) as unknown as CouponRow[];
  const orgs = await getWritableOrgs(supabase, MANAGEMENT_ROLES);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-h1 text-bone">Coupons</h1>
      </div>

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
          {error}
        </p>
      ) : null}

      {coupons.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-ash ">
          No coupons yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
          {coupons.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3">
              <span className="flex flex-col">
                <span className="font-mono font-medium">{c.code}</span>
                <span className="text-xs text-ash">
                  {c.organization?.name ? `${c.organization.name} · ` : ""}
                  {c.active ? "active" : "inactive"}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-sm">{describeDiscount(c)}</span>
                {orgs.length > 0 ? (
                  <form action={toggleCouponActive}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="active" value={String(c.active)} />
                    <button className="rounded-md border border-iron px-2 py-1 text-xs font-medium hover:bg-onyx-2 hover:bg-onyx-2">
                      {c.active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {orgs.length > 0 ? (
        <form action={createCoupon} className="flex flex-wrap items-end gap-2 rounded-md border border-onyx bg-onyx p-4">
          <h2 className="w-full text-sm font-medium">New coupon</h2>
          <OrgPicker orgs={orgs} />
          <input name="code" aria-label="Coupon code" required placeholder="CODE" className="flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <select name="discount_type" aria-label="Discount type" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
            {DISCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input name="discount_value" aria-label="Discount value" type="number" min="0" step="0.01" required placeholder="Value" className="w-24 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <button className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
            Create
          </button>
        </form>
      ) : (
        <p className="text-sm text-ash">You need a manager+ role to create coupons.</p>
      )}
    </main>
  );
}
