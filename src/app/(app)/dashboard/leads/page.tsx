import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { LEAD_STAGES } from "@/lib/crm";
import { createLead, updateLeadStage, convertLead } from "./actions";

export const dynamic = "force-dynamic";

type Lead = {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  stage: string;
};

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgs = await getWritableOrgs(supabase);
  const { data: leadData } = await supabase
    .from("leads")
    .select("id, organization_id, name, email, phone, source, stage")
    .order("created_at", { ascending: false })
    .limit(300);
  const leads = (leadData ?? []) as unknown as Lead[];

  const byStage = (s: string) => leads.filter((l) => l.stage === s);
  const openStages = LEAD_STAGES.filter((s) => s !== "won" && s !== "lost");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">← Dashboard</Link>
        <h1 className="mt-1 text-h1 text-bone">Leads &amp; sales pipeline</h1>
        <p className="text-sm text-ash">Capture prospects and move them to members.</p>
      </div>

      {error ? <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p> : null}

      {orgs.length > 0 ? (
        <form action={createLead} className="flex flex-wrap items-end gap-3 rounded-md border border-onyx bg-onyx p-5">
          <OrgPicker orgs={orgs} />
          <input name="name" aria-label="Lead name" required placeholder="Name" className="min-w-0 flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <input name="email" aria-label="Lead email" type="email" placeholder="Email" className="min-w-0 flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <input name="phone" aria-label="Lead phone" placeholder="Phone" className="w-32 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <input name="source" aria-label="Lead source" placeholder="Source" className="w-28 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <button className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Add lead</button>
        </form>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {openStages.map((stage) => (
          <div key={stage} className="flex flex-col gap-2 rounded-md border border-onyx bg-onyx p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-gold">{stage}</span>
              <span className="text-xs text-ash">{byStage(stage).length}</span>
            </div>
            {byStage(stage).map((l) => (
              <div key={l.id} className="rounded-md border border-iron p-2 text-sm">
                <div className="font-medium">{l.name}</div>
                <div className="text-xs text-ash">{l.email ?? l.phone ?? l.source ?? ""}</div>
                <div className="mt-1 flex items-center gap-1">
                  <form action={updateLeadStage} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={l.id} />
                    <select name="stage" aria-label={`Stage for ${l.name}`} defaultValue={l.stage} className="rounded-md border border-iron bg-transparent px-1 py-0.5 text-[11px]">
                      {LEAD_STAGES.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                    <button className="rounded border border-iron px-1 py-0.5 text-[11px] hover:border-gold hover:text-gold">Move</button>
                  </form>
                  <form action={convertLead}>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="organization_id" value={l.organization_id} />
                    <input type="hidden" name="name" value={l.name} />
                    <input type="hidden" name="email" value={l.email ?? ""} />
                    <input type="hidden" name="phone" value={l.phone ?? ""} />
                    <button className="rounded bg-gold px-1.5 py-0.5 text-[11px] font-medium text-black hover:opacity-90">→ Member</button>
                  </form>
                </div>
              </div>
            ))}
            {byStage(stage).length === 0 ? <span className="text-xs text-ash">—</span> : null}
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-1 text-sm">
        <h2 className="text-sm font-medium text-ash">Closed</h2>
        <p className="text-xs text-ash">Won: {byStage("won").length} · Lost: {byStage("lost").length}</p>
      </section>
    </main>
  );
}
