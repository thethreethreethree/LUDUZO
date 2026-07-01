import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { createGroup } from "./actions";

export const dynamic = "force-dynamic";

const GROUP_TYPES = ["family", "corporate", "group"] as const;

type GroupRow = {
  id: string;
  name: string;
  group_type: string;
  organization: { name: string } | null;
};

export default async function GroupsPage({
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
    .from("member_groups")
    .select("id, name, group_type, organization:organizations(name)")
    .order("name", { ascending: true })
    .limit(200);
  const groups = (data ?? []) as unknown as GroupRow[];
  const orgs = await getWritableOrgs(supabase);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-h1 text-bone">
          Groups & accounts
        </h1>
        <p className="text-sm text-ash">Family, corporate, and general groups.</p>
      </div>

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
          {error}
        </p>
      ) : null}

      {groups.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-ash ">
          No groups yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                href={`/dashboard/groups/${g.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-onyx-2 hover:bg-onyx-2"
              >
                <span className="flex flex-col">
                  <span className="font-medium">{g.name}</span>
                  <span className="text-xs text-ash">
                    {g.organization?.name ? `${g.organization.name} · ` : ""}
                    {g.group_type}
                  </span>
                </span>
                <span className="text-xs text-ash">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {orgs.length > 0 ? (
        <form action={createGroup} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-4">
          <h2 className="text-sm font-medium">Create group</h2>
          <OrgPicker orgs={orgs} />
          <div className="flex gap-3">
            <input name="name" required placeholder="Group name" className="flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            <select name="group_type" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
              {GROUP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
            Create group
          </button>
        </form>
      ) : (
        <p className="text-sm text-ash">
          You need a staff role in a gym to create groups.
        </p>
      )}
    </main>
  );
}
