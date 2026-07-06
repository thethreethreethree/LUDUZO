import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateOrgSettings, generateApiKey, revokeApiKey, addWebhook, deleteWebhook } from "./actions";

export const dynamic = "force-dynamic";

type Org = {
  id: string; name: string; role: string;
  plan_tier: string; default_currency: string; locale: string;
  settings: { phone?: string; address?: string; hours?: string; amenities?: string; cancellation_policy?: string } | null;
};
type ApiKey = { id: string; name: string; key_prefix: string; revoked: boolean; last_used_at: string | null };
type Webhook = { id: string; url: string; event_types: string[]; active: boolean };

const TIERS = ["free", "starter", "pro", "enterprise"];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Orgs where the caller is owner/admin (platform admin scope).
  const { data: memData } = await supabase
    .from("organization_members")
    .select("role, organization:organizations(id, name, plan_tier, default_currency, locale, settings)")
    .in("role", ["owner", "admin"]);
  const orgs: Org[] = ((memData ?? []) as unknown as { role: string; organization: Omit<Org, "role"> | null }[])
    .filter((m) => m.organization)
    .map((m) => ({ ...(m.organization as Omit<Org, "role">), role: m.role }));

  const { data: keyData } = await supabase.from("api_keys").select("id, name, key_prefix, revoked, last_used_at").order("created_at", { ascending: false });
  const keys = (keyData ?? []) as unknown as ApiKey[];
  const { data: whData } = await supabase.from("webhooks").select("id, url, event_types, active").order("created_at", { ascending: false });
  const webhooks = (whData ?? []) as unknown as Webhook[];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">← Dashboard</Link>
        <h1 className="mt-1 text-h1 text-bone">Admin</h1>
        <p className="text-sm text-ash">Plan tier, localisation, gym info, API &amp; webhooks.</p>
      </div>

      {error ? <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p> : null}
      {ok ? <p className="break-all rounded-md border border-l-2 border-onyx border-l-gold px-3 py-2 text-sm text-gold">{ok}</p> : null}

      {orgs.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-ash">You don&apos;t own or admin any gym.</p>
      ) : (
        orgs.map((o) => (
          <form key={o.id} action={updateOrgSettings} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-5">
            <input type="hidden" name="organization_id" value={o.id} />
            <div className="flex items-center justify-between">
              <span className="font-medium">{o.name}</span>
              <span className="text-xs text-gold">{o.role}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <p className="text-xs text-ash sm:col-span-3">
                Branding — logo, colours, and app icon — lives in{" "}
                <Link href="/dashboard/settings" className="font-medium text-gold hover:underline">Settings</Link>,
                which is what the member app actually reads.
              </p>
              <label className="flex flex-col gap-1 text-xs text-ash">Plan tier
                <select name="plan_tier" defaultValue={o.plan_tier} className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
                  {TIERS.map((t) => (<option key={t} value={t}>{t}</option>))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-ash">Currency
                <input name="default_currency" defaultValue={o.default_currency} className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ash">Locale
                <input name="locale" defaultValue={o.locale} className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ash">Front-desk phone (members can call)
                <input name="contact_phone" defaultValue={o.settings?.phone ?? ""} placeholder="+1 555 123 4567" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ash">Address (members see this)
                <input name="address" defaultValue={o.settings?.address ?? ""} placeholder="123 Main St, City" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ash">Opening hours
                <input name="hours" defaultValue={o.settings?.hours ?? ""} placeholder="Mon–Fri 6am–10pm · Sat–Sun 8am–6pm" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ash">Amenities
                <input name="amenities" defaultValue={o.settings?.amenities ?? ""} placeholder="Sauna · Pool · Free parking" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ash sm:col-span-2">Class cancellation policy (members see this when booking)
                <input name="cancellation_policy" defaultValue={o.settings?.cancellation_policy ?? ""} placeholder="e.g. Cancel at least 4 hours before class to avoid a no-show mark." className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
              </label>
            </div>
            <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Save settings</button>
          </form>
        ))
      )}

      {orgs.length > 0 ? (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-ash">API keys</h2>
            <form action={generateApiKey} className="flex gap-2 rounded-md border border-onyx bg-onyx p-4">
              <input type="hidden" name="organization_id" value={orgs[0].id} />
              <input name="name" placeholder="Key name" className="min-w-0 flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
              <button className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Generate</button>
            </form>
            {keys.length > 0 ? (
              <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx">
                {keys.map((k) => (
                  <li key={k.id} className={`flex items-center justify-between px-4 py-2 text-sm ${k.revoked ? "opacity-50" : ""}`}>
                    <span className="font-mono text-xs">{k.key_prefix}… · {k.name}{k.revoked ? " · revoked" : ""}</span>
                    {!k.revoked ? (
                      <form action={revokeApiKey}><input type="hidden" name="id" value={k.id} />
                        <button className="rounded-md border border-iron px-2 py-1 text-xs hover:border-gold hover:text-gold">Revoke</button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-ash">Webhooks</h2>
            <form action={addWebhook} className="flex flex-col gap-2 rounded-md border border-onyx bg-onyx p-4 sm:flex-row">
              <input type="hidden" name="organization_id" value={orgs[0].id} />
              <input name="url" required placeholder="https://your-endpoint" className="min-w-0 flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
              <input name="event_types" placeholder="member.created, invoice.paid" className="min-w-0 flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
              <button className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Add</button>
            </form>
            {webhooks.length > 0 ? (
              <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx">
                {webhooks.map((w) => (
                  <li key={w.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="min-w-0 truncate font-mono text-xs">{w.url} · {w.event_types.join(", ") || "all"}</span>
                    <form action={deleteWebhook}><input type="hidden" name="id" value={w.id} />
                      <button className="rounded-md border border-iron px-2 py-1 text-xs hover:border-gold hover:text-gold">Delete</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-[10px] text-ash">Registration only — event delivery requires a background job runner (not implemented).</p>
          </section>
        </>
      ) : null}
    </main>
  );
}
