import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { importMembers } from "../actions";

export const dynamic = "force-dynamic";

export default async function ImportMembersPage({
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

  const orgs = await getWritableOrgs(supabase);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-8">
      <Link href="/dashboard/members" className="text-sm text-ash hover:underline">
        ← Members
      </Link>
      <h1 className="text-h1 text-bone">Import members</h1>
      <p className="text-sm text-ash">
        One member per line: <span className="font-mono">first,last,email,phone</span> (email and phone
        optional).
      </p>

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
          {error}
        </p>
      ) : null}

      {orgs.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-ash ">
          You don&apos;t manage any gym.
        </p>
      ) : (
        <form action={importMembers} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-5">
          <OrgPicker orgs={orgs} />
          <textarea
            name="rows"
            aria-label="Member rows (CSV: first, last, email, phone)"
            rows={10}
            required
            placeholder={"Jane,Doe,jane@example.com,555-1234\nJohn,Smith,john@example.com"}
            className="rounded-md border border-iron px-3 py-2 font-mono text-sm bg-onyx-2"
          />
          <button className="self-start rounded-md bg-gold px-4 py-2.5 text-sm font-medium text-black hover:opacity-90">
            Import
          </button>
        </form>
      )}
    </main>
  );
}
