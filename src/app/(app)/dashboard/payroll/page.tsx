import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { MANAGEMENT_ROLES, formatMoney } from "@/lib/billing";
import { OrgPicker } from "@/components/OrgPicker";
import { createCommission } from "./actions";

export const dynamic = "force-dynamic";

type CommissionRow = {
  id: string;
  amount_cents: number;
  currency: string;
  reason: string | null;
  status: string;
  staff: { full_name: string | null; email: string | null } | null;
};

type StaffOpt = {
  user_id: string;
  user: { full_name: string | null; email: string | null } | null;
};

export default async function PayrollPage({
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

  const { data: commData } = await supabase
    .from("commissions")
    .select("id, amount_cents, currency, reason, status, staff:profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);
  const commissions = (commData ?? []) as unknown as CommissionRow[];

  const orgs = await getWritableOrgs(supabase, MANAGEMENT_ROLES);

  const { data: staffData } = await supabase
    .from("organization_members")
    .select("user_id, user:profiles(full_name, email)")
    .limit(500);
  const staff = (staffData ?? []) as unknown as StaffOpt[];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Payroll & commissions</h1>
        <p className="text-sm text-zinc-500">Visible to management, and to each staff member for their own.</p>
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {commissions.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-zinc-500 ">
          No commissions recorded.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
          {commissions.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3">
              <span className="flex flex-col">
                <span className="font-medium">{c.staff?.full_name ?? c.staff?.email ?? "(staff)"}</span>
                <span className="text-xs text-zinc-500">
                  {c.reason ?? "—"} · {c.status}
                </span>
              </span>
              <span className="text-sm">{formatMoney(c.amount_cents, c.currency)}</span>
            </li>
          ))}
        </ul>
      )}

      {orgs.length > 0 && staff.length > 0 ? (
        <form action={createCommission} className="flex flex-wrap items-end gap-2 rounded-md border border-onyx bg-onyx p-4">
          <h2 className="w-full text-sm font-medium">Record commission</h2>
          <OrgPicker orgs={orgs} />
          <select name="staff_user_id" required className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <option value="">— staff —</option>
            {staff.map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {s.user?.full_name ?? s.user?.email ?? s.user_id.slice(0, 8)}
              </option>
            ))}
          </select>
          <input name="amount" type="number" min="0" step="0.01" required placeholder="Amount" className="w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          <input name="reason" placeholder="Reason" className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          <button className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
            Record
          </button>
        </form>
      ) : (
        <p className="text-sm text-zinc-500">You need a manager+ role to record commissions.</p>
      )}
    </main>
  );
}
