import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { addCertification, deleteCertification } from "./actions";

export const dynamic = "force-dynamic";

type Cert = {
  id: string;
  name: string;
  issuer: string | null;
  issued_on: string | null;
  expires_on: string | null;
  staff: { full_name: string | null } | null;
};
type StaffOpt = { user_id: string; profile: { full_name: string | null } | null };

function expiryState(expires_on: string | null): { label: string; cls: string } {
  if (!expires_on) return { label: "no expiry", cls: "text-ash" };
  const days = Math.floor((Date.parse(expires_on) - new Date().getTime()) / (24 * 3600 * 1000));
  if (days < 0) return { label: `expired ${-days}d ago`, cls: "text-loss font-medium" };
  if (days <= 30) return { label: `expires in ${days}d`, cls: "text-gold font-medium" };
  return { label: `valid · ${expires_on}`, cls: "text-ash" };
}

export default async function CertificationsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgs = await getWritableOrgs(supabase);

  const { data: certData } = await supabase
    .from("staff_certifications")
    .select("id, name, issuer, issued_on, expires_on, staff:profiles(full_name)")
    .order("expires_on", { ascending: true, nullsFirst: false })
    .limit(200);
  const certs = (certData ?? []) as unknown as Cert[];

  const { data: staffData } = await supabase
    .from("organization_members")
    .select("user_id, profile:profiles(full_name)")
    .limit(200);
  const staff = (staffData ?? []) as unknown as StaffOpt[];

  const expiringSoon = certs.filter((c) => {
    if (!c.expires_on) return false;
    const days = Math.floor((Date.parse(c.expires_on) - new Date().getTime()) / (24 * 3600 * 1000));
    return days <= 30;
  }).length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">← Dashboard</Link>
        <h1 className="mt-1 text-h1 text-bone">Certifications</h1>
        <p className="text-sm text-ash">
          Track staff licenses & expiry.{expiringSoon > 0 ? ` ${expiringSoon} expiring within 30 days.` : ""}
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>
      ) : null}

      {orgs.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-ash">You don&apos;t manage any gym.</p>
      ) : (
        <form action={addCertification} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-5">
          <OrgPicker orgs={orgs} />
          <div className="flex gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ash">Staff
              <select name="staff_id" required className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
                <option value="">Select…</option>
                {staff.map((s) => (<option key={s.user_id} value={s.user_id}>{s.profile?.full_name ?? "(staff)"}</option>))}
              </select>
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ash">Certification
              <input name="name" required placeholder="e.g. CPR / L2 PT" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            </label>
          </div>
          <div className="flex gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ash">Issuer
              <input name="issuer" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ash">Issued
              <input name="issued_on" type="date" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ash">Expires
              <input name="expires_on" type="date" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            </label>
          </div>
          <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Add certification</button>
        </form>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">On file</h2>
        {certs.length === 0 ? (
          <p className="text-sm text-ash">No certifications recorded.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx">
            {certs.map((c) => {
              const st = expiryState(c.expires_on);
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="flex min-w-0 flex-col">
                    <span className="font-medium">{c.name}{c.staff?.full_name ? ` · ${c.staff.full_name}` : ""}</span>
                    <span className={`text-xs ${st.cls}`}>{st.label}{c.issuer ? ` · ${c.issuer}` : ""}</span>
                  </div>
                  <form action={deleteCertification}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="rounded-md border border-iron px-2 py-1 text-xs font-medium hover:border-gold hover:text-gold">Remove</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
