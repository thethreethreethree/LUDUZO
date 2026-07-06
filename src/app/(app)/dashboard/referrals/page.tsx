import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { createReferral, updateReferralStatus } from "./actions";

const REFERRAL_STATUSES = ["pending", "joined", "rewarded", "expired"];

export const dynamic = "force-dynamic";

type ReferralRow = {
  id: string;
  referred_name: string | null;
  referred_email: string | null;
  status: string;
  organization: { name: string } | null;
};

export default async function ReferralsPage({
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
    .from("referrals")
    .select("id, referred_name, referred_email, status, organization:organizations(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const referrals = (data ?? []) as unknown as ReferralRow[];
  const orgs = await getWritableOrgs(supabase);

  const { data: memberData } = await supabase
    .from("members")
    .select("id, first_name, last_name")
    .order("last_name", { ascending: true })
    .limit(500);
  const members = (memberData ?? []) as unknown as { id: string; first_name: string; last_name: string }[];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-ash hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-h1 text-bone">Referrals</h1>
        </div>
        <a
          href="/dashboard/referrals/export"
          className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold"
        >
          Export CSV
        </a>
      </header>

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
          {error}
        </p>
      ) : null}

      {referrals.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-ash ">
          No referrals yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
          {referrals.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-4 py-3">
              <span className="flex flex-col">
                <span className="font-medium">{r.referred_name ?? "—"}</span>
                <span className="text-xs text-ash">
                  {r.organization?.name ? `${r.organization.name} · ` : ""}
                  {r.referred_email ?? "—"}
                </span>
              </span>
              <form action={updateReferralStatus} className="flex items-center gap-2">
                <input type="hidden" name="id" value={r.id} />
                <select
                  name="status"
                  aria-label={`Status for ${r.referred_name}`}
                  defaultValue={r.status}
                  className="rounded-md border border-iron px-2 py-1 text-xs bg-onyx-2"
                >
                  {REFERRAL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button className="rounded-md border border-iron px-2 py-1 text-xs font-medium hover:bg-onyx-2 hover:bg-onyx-2">
                  Save
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {orgs.length > 0 ? (
        <form action={createReferral} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-4">
          <h2 className="text-sm font-medium">Log referral</h2>
          <OrgPicker orgs={orgs} />
          <div className="flex gap-3">
            <input name="referred_name" aria-label="Referred person's name" required placeholder="Referred person's name" className="flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            <input name="referred_email" aria-label="Referred person's email (optional)" type="email" placeholder="Email (optional)" className="flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          </div>
          <select name="referrer_member_id" aria-label="Referred by (optional)" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
            <option value="">Referred by (optional)</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.last_name}, {m.first_name}
              </option>
            ))}
          </select>
          <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
            Log referral
          </button>
        </form>
      ) : (
        <p className="text-sm text-ash">
          You need a staff role in a gym to log referrals.
        </p>
      )}
    </main>
  );
}
