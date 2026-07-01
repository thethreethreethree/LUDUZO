import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createMember } from "../actions";

export const dynamic = "force-dynamic";

// Roles permitted to manage members (mirrors members_write RLS in migration 0002).
const WRITABLE_ROLES = ["owner", "admin", "manager", "front_desk"];

type OrgOption = { role: string; organization: { id: string; name: string } | null };

export default async function NewMemberPage({
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
    .from("organization_members")
    .select("role, organization:organizations(id, name)");
  const orgs = ((data ?? []) as unknown as OrgOption[]).filter(
    (o) => WRITABLE_ROLES.includes(o.role) && o.organization,
  );

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 p-8">
      <Link href="/dashboard/members" className="text-sm text-ash hover:underline">
        ← Members
      </Link>
      <h1 className="text-h1 text-bone">Add member</h1>

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
          {error}
        </p>
      ) : null}

      {orgs.length === 0 ? (
        <div className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-ash ">
          <p>You don&apos;t manage any gym yet.</p>
          <Link href="/onboarding" className="mt-2 inline-block font-medium text-gold hover:underline">
            Create your gym →
          </Link>
        </div>
      ) : (
        <form action={createMember} autoComplete="off" className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-5">
          {orgs.length === 1 ? (
            <input type="hidden" name="organization_id" value={orgs[0].organization!.id} />
          ) : (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Gym</span>
              <select
                name="organization_id"
                required
                data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other" className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2"
              >
                {orgs.map((o) => (
                  <option key={o.organization!.id} value={o.organization!.id}>
                    {o.organization!.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">First name</span>
              <input name="first_name" required data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other" className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2" />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">Last name</span>
              <input name="last_name" required data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other" className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2" />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Email</span>
            <input type="email" name="email" data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other" className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Phone</span>
            <input name="phone" data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other" className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2" />
          </label>
          <div className="flex gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">Member # (optional)</span>
              <input name="member_number" data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other" className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2" />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">Date of birth</span>
              <input name="date_of_birth" type="date" data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other" className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2" />
            </label>
          </div>

          <button className="mt-2 rounded-md bg-gold px-4 py-2.5 text-sm font-medium text-black hover:opacity-90">
            Add member
          </button>
        </form>
      )}
    </main>
  );
}
