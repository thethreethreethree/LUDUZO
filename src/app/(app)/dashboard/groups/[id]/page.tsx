import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateGroup } from "../actions";

export const dynamic = "force-dynamic";

const GROUP_TYPES = ["family", "corporate", "group"];

type Group = { id: string; name: string; group_type: string; organization: { name: string } | null };
type Link = {
  id: string;
  relationship: string | null;
  member: { id: string; first_name: string; last_name: string } | null;
};

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: groupData } = await supabase
    .from("member_groups")
    .select("id, name, group_type, organization:organizations(name)")
    .eq("id", id)
    .maybeSingle();
  const group = groupData as unknown as Group | null;

  if (!group) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-8">
        <Link href="/dashboard/groups" className="text-sm text-ash hover:underline">
          ← Groups
        </Link>
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-ash ">
          Group not found (or not in your gym).
        </p>
      </main>
    );
  }

  const { data: linkData } = await supabase
    .from("member_group_links")
    .select("id, relationship, member:members(id, first_name, last_name)")
    .eq("group_id", id)
    .limit(200);
  const links = (linkData ?? []) as unknown as Link[];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard/groups" className="text-sm text-ash hover:underline">
          ← Groups
        </Link>
        <h1 className="mt-1 text-h1 text-bone">{group.name}</h1>
        <p className="text-sm text-ash">
          {group.organization?.name ? `${group.organization.name} · ` : ""}
          {group.group_type}
        </p>
        <form action={updateGroup} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={group.id} />
          <input name="name" aria-label="Group name" defaultValue={group.name} className="w-full rounded-md border border-iron px-3 py-1.5 text-sm bg-onyx-2" />
          <select name="group_type" aria-label="Group type" defaultValue={group.group_type} className="rounded-md border border-iron px-2 py-1.5 text-sm bg-onyx-2">
            {GROUP_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button className="rounded-md border border-iron px-3 py-1.5 text-xs font-medium hover:bg-onyx-2 hover:bg-onyx-2">
            Save
          </button>
        </form>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Members</h2>
        {links.length === 0 ? (
          <p className="text-sm text-ash">
            No members yet. Add members to this group from a member&apos;s page.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
            {links.map((l) => (
              <li key={l.id} className="flex items-center justify-between px-4 py-3">
                {l.member ? (
                  <Link href={`/dashboard/members/${l.member.id}`} className="font-medium hover:underline">
                    {l.member.first_name} {l.member.last_name}
                  </Link>
                ) : (
                  <span className="text-ash">(member)</span>
                )}
                {l.relationship ? (
                  <span className="text-xs text-ash">{l.relationship}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
