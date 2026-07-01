import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { formatMoney } from "@/lib/billing";
import { OrgPicker } from "@/components/OrgPicker";
import { createInvoice, markInvoicePaid, voidInvoice, recordRefund, suspendOverdue } from "./actions";

export const dynamic = "force-dynamic";

type InvoiceRow = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  due_date: string | null;
  member: { first_name: string; last_name: string } | null;
  organization: { name: string } | null;
};

export default async function InvoicesPage({
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
    .from("invoices")
    .select("id, amount_cents, currency, status, due_date, member:members(first_name, last_name), organization:organizations(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const invoices = (data ?? []) as unknown as InvoiceRow[];
  const orgs = await getWritableOrgs(supabase);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Invoices</h1>
        </div>
        <a
          href="/dashboard/invoices/export"
          className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold"
        >
          Export CSV
        </a>
      </header>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-md border border-l-2 border-onyx border-l-gold px-3 py-2 text-sm text-gold">{ok}</p>
      ) : null}

      {orgs.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <form action={recordRefund} className="flex flex-col gap-2 rounded-md border border-onyx bg-onyx p-4">
            <span className="text-sm font-medium">Record a refund</span>
            <OrgPicker orgs={orgs} />
            <div className="flex gap-2">
              <input name="amount" type="number" step="0.01" min="0" required placeholder="Amount" className="w-28 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
              <input name="reason" placeholder="Reason (optional)" className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
            </div>
            <button className="self-start rounded-md border border-iron px-3 py-1.5 text-xs font-medium hover:border-gold hover:text-gold">Record refund</button>
          </form>
          <form action={suspendOverdue} className="flex flex-col justify-between gap-2 rounded-md border border-onyx bg-onyx p-4">
            <div>
              <span className="text-sm font-medium">Auto-suspension</span>
              <p className="mt-1 text-xs text-zinc-500">Freeze active members who have a past-due invoice.</p>
            </div>
            <OrgPicker orgs={orgs} />
            <button className="self-start rounded-md border border-iron px-3 py-1.5 text-xs font-medium hover:border-gold hover:text-gold">Suspend overdue members</button>
          </form>
        </section>
      ) : null}

      {invoices.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-zinc-500 ">
          No invoices yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
          {invoices.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between px-4 py-3">
              <span className="flex flex-col">
                <span className="font-medium">{formatMoney(inv.amount_cents, inv.currency)}</span>
                <span className="text-xs text-zinc-500">
                  {inv.member ? `${inv.member.first_name} ${inv.member.last_name} · ` : ""}
                  {inv.organization?.name ? `${inv.organization.name} · ` : ""}
                  {inv.status}
                  {inv.due_date ? ` · due ${inv.due_date}` : ""}
                </span>
              </span>
              {inv.status === "paid" ? (
                <span className="text-xs text-green-600 dark:text-green-400">paid</span>
              ) : inv.status === "void" ? (
                <span className="text-xs text-zinc-400">void</span>
              ) : (
                <div className="flex items-center gap-2">
                  <form action={markInvoicePaid}>
                    <input type="hidden" name="id" value={inv.id} />
                    <button className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                      Mark paid
                    </button>
                  </form>
                  <form action={voidInvoice}>
                    <input type="hidden" name="id" value={inv.id} />
                    <button className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                      Void
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {orgs.length > 0 ? (
        <form action={createInvoice} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-4">
          <h2 className="text-sm font-medium">New invoice</h2>
          <OrgPicker orgs={orgs} />
          <div className="flex gap-3">
            <input name="amount" type="number" min="0" step="0.01" required placeholder="Amount" className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
            <input name="due_date" type="date" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          </div>
          <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
            Create invoice
          </button>
        </form>
      ) : (
        <p className="text-sm text-zinc-500">You need a staff role in a gym to create invoices.</p>
      )}
    </main>
  );
}
