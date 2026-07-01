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
      <Link href="/dashboard/members" className="text-sm text-zinc-500 hover:underline">
        ← Members
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Import members</h1>
      <p className="text-sm text-zinc-500">
        One member per line: <span className="font-mono">first,last,email,phone</span> (email and phone
        optional).
      </p>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {orgs.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-zinc-500 ">
          You don&apos;t manage any gym.
        </p>
      ) : (
        <form action={importMembers} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-5">
          <OrgPicker orgs={orgs} />
          <textarea
            name="rows"
            rows={10}
            required
            placeholder={"Jane,Doe,jane@example.com,555-1234\nJohn,Smith,john@example.com"}
            className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button className="self-start rounded-md bg-gold px-4 py-2.5 text-sm font-medium text-black hover:opacity-90">
            Import
          </button>
        </form>
      )}
    </main>
  );
}
