import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { issueGuestPass, updateGuestPassStatus } from "./actions";

const GUEST_PASS_STATUSES = ["issued", "redeemed", "expired", "revoked"];

export const dynamic = "force-dynamic";

type GuestPassRow = {
  id: string;
  guest_name: string;
  guest_email: string | null;
  code: string | null;
  status: string;
  issued_at: string;
  expires_at: string | null;
  organization: { name: string } | null;
};

export default async function GuestPassesPage({
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
    .from("guest_passes")
    .select("id, guest_name, guest_email, code, status, issued_at, expires_at, organization:organizations(name)")
    .order("issued_at", { ascending: false })
    .limit(200);
  const passes = (data ?? []) as unknown as GuestPassRow[];
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
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Guest passes</h1>
        </div>
        <a
          href="/dashboard/guest-passes/export"
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

      {passes.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-zinc-500 ">
          No guest passes issued yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
          {passes.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <span className="flex flex-col">
                <span className="font-medium">{p.guest_name}</span>
                <span className="text-xs text-zinc-500">
                  {p.organization?.name ? `${p.organization.name} · ` : ""}
                  {p.code ? `code ${p.code}` : "—"}
                  {p.expires_at ? ` · expires ${p.expires_at}` : ""}
                </span>
              </span>
              <form action={updateGuestPassStatus} className="flex items-center gap-2">
                <input type="hidden" name="id" value={p.id} />
                <select
                  name="status"
                  defaultValue={p.status}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {GUEST_PASS_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                  Save
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {orgs.length > 0 ? (
        <form action={issueGuestPass} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-4">
          <h2 className="text-sm font-medium">Issue guest pass</h2>
          <OrgPicker orgs={orgs} />
          <div className="flex gap-3">
            <input name="guest_name" required placeholder="Guest name" className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
            <input name="guest_email" type="email" placeholder="Email (optional)" className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          </div>
          <div className="flex gap-3">
            <select name="host_member_id" className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="">Host member (optional)</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.last_name}, {m.first_name}
                </option>
              ))}
            </select>
            <input name="expires_at" type="date" title="Expires" className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          </div>
          <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
            Issue pass
          </button>
        </form>
      ) : (
        <p className="text-sm text-zinc-500">
          You need a staff role in a gym to issue guest passes.
        </p>
      )}
    </main>
  );
}
