import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { recordCheckin, checkoutCheckin } from "./actions";

export const dynamic = "force-dynamic";

type OpenCheckin = {
  id: string;
  checked_in_at: string;
  member: { first_name: string; last_name: string } | null;
  organization: { name: string } | null;
};

type MemberOpt = {
  id: string;
  first_name: string;
  last_name: string;
  organization: { name: string } | null;
};

export default async function CheckinsPage({
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

  const { data: openData } = await supabase
    .from("checkins")
    .select("id, checked_in_at, member:members(first_name, last_name), organization:organizations(name)")
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: false })
    .limit(500);
  const open = (openData ?? []) as unknown as OpenCheckin[];

  const { data: memberData } = await supabase
    .from("members")
    .select("id, first_name, last_name, organization:organizations(name)")
    .order("last_name", { ascending: true })
    .limit(500);
  const members = (memberData ?? []) as unknown as MemberOpt[];

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count: todayCount } = await supabase
    .from("checkins")
    .select("id", { count: "exact", head: true })
    .gte("checked_in_at", startOfDay.toISOString());

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Check-ins</h1>
        </div>
        <a
          href="/dashboard/checkins/export"
          className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold"
        >
          Export attendance
        </a>
      </header>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-onyx bg-onyx p-4">
          <div className="text-xs text-zinc-500">Currently in the gym</div>
          <div className="text-3xl font-semibold tracking-tight">{open.length}</div>
        </div>
        <div className="rounded-md border border-onyx bg-onyx p-4">
          <div className="text-xs text-zinc-500">Check-ins today</div>
          <div className="text-3xl font-semibold tracking-tight">{todayCount ?? 0}</div>
        </div>
      </div>

      {members.length > 0 ? (
        <form action={recordCheckin} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-4">
          <h2 className="text-sm font-medium">Check someone in</h2>
          <select name="member_id" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <option value="">— pick a member —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.last_name}, {m.first_name}
                {m.organization?.name ? ` (${m.organization.name})` : ""}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">or scan/enter QR token</span>
            <input name="qr_token" placeholder="QR token" className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          </div>
          <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
            Check in
          </button>
        </form>
      ) : (
        <p className="text-sm text-zinc-500">No members to check in yet.</p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-zinc-500">In the gym now</h2>
        {open.length === 0 ? (
          <p className="text-sm text-zinc-500">Nobody is checked in.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
            {open.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3">
                <span className="flex flex-col">
                  <span className="font-medium">
                    {c.member ? `${c.member.first_name} ${c.member.last_name}` : "(member)"}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {c.organization?.name ? `${c.organization.name} · ` : ""}
                    since {new Date(c.checked_in_at).toLocaleTimeString()}
                  </span>
                </span>
                <form action={checkoutCheckin}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                    Check out
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
