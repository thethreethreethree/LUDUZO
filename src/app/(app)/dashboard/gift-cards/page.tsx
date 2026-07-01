import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { formatMoney } from "@/lib/billing";
import { issueGiftCard, deactivateGiftCard } from "./actions";

export const dynamic = "force-dynamic";

type Card = {
  id: string;
  code: string;
  initial_cents: number;
  balance_cents: number;
  active: boolean;
  member: { first_name: string; last_name: string } | null;
};
type MemberOpt = { id: string; first_name: string; last_name: string };

export default async function GiftCardsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgs = await getWritableOrgs(supabase);
  const { data: cardData } = await supabase
    .from("gift_cards")
    .select("id, code, initial_cents, balance_cents, active, member:members(first_name, last_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const cards = (cardData ?? []) as unknown as Card[];
  const { data: memberData } = await supabase.from("members").select("id, first_name, last_name").order("last_name").limit(500);
  const members = (memberData ?? []) as unknown as MemberOpt[];

  const outstanding = cards.filter((c) => c.active).reduce((s, c) => s + c.balance_cents, 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">← Dashboard</Link>
        <h1 className="mt-1 text-h1 text-bone">Gift cards</h1>
        <p className="text-sm text-ash">{formatMoney(outstanding)} outstanding balance across active cards.</p>
      </div>

      {error ? <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p> : null}

      {orgs.length > 0 ? (
        <form action={issueGiftCard} className="flex flex-wrap items-end gap-3 rounded-md border border-onyx bg-onyx p-5">
          <OrgPicker orgs={orgs} />
          <input name="code" required placeholder="CODE" className="w-32 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <input name="amount" type="number" step="0.01" min="0" required placeholder="Amount" className="w-28 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <select name="issued_to_member" className="min-w-0 flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
            <option value="">— unassigned —</option>
            {members.map((m) => (<option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>))}
          </select>
          <button className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Issue</button>
        </form>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Cards</h2>
        {cards.length === 0 ? (
          <p className="text-sm text-ash">No gift cards issued.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx">
            {cards.map((c) => (
              <li key={c.id} className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${c.active ? "" : "opacity-50"}`}>
                <div className="flex min-w-0 flex-col">
                  <span className="font-mono font-medium">{c.code}</span>
                  <span className="text-xs text-ash">
                    {formatMoney(c.balance_cents)} / {formatMoney(c.initial_cents)}
                    {c.member ? ` · ${c.member.first_name} ${c.member.last_name}` : ""}
                    {c.active ? "" : " · inactive"}
                  </span>
                </div>
                {c.active ? (
                  <form action={deactivateGiftCard}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="rounded-md border border-iron px-2 py-1 text-xs font-medium hover:border-gold hover:text-gold">Deactivate</button>
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
