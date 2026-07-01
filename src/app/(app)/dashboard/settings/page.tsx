import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateOrganization } from "./actions";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["owner", "admin"];

type Row = {
  role: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    settings: { brand_color?: string; logo_url?: string } | null;
  } | null;
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("organization_members")
    .select("role, organization:organizations(id, name, slug, settings)");
  const orgs = ((data ?? []) as unknown as Row[]).filter(
    (r) => ADMIN_ROLES.includes(r.role) && r.organization,
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-500">Rename the gyms you own or administer.</p>
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          Saved.
        </p>
      ) : null}

      {orgs.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-zinc-500 ">
          You don&apos;t own or administer any gym.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {orgs.map((r) => (
            <li key={r.organization!.id}>
              <form action={updateOrganization} className="flex items-end gap-2 rounded-md border border-onyx bg-onyx p-4">
                <input type="hidden" name="id" value={r.organization!.id} />
                <div className="flex flex-1 flex-col gap-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Gym name</span>
                    <input
                      name="name"
                      required
                      defaultValue={r.organization!.name}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    <span className="text-xs text-zinc-500">/{r.organization!.slug}</span>
                  </label>
                  <div className="flex gap-3">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">Brand color</span>
                      <input
                        name="brand_color"
                        type="color"
                        defaultValue={r.organization!.settings?.brand_color ?? "#000000"}
                        className="h-10 w-16 rounded-md border border-zinc-300 dark:border-zinc-700"
                      />
                    </label>
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                      <span className="font-medium">Logo URL</span>
                      <input
                        name="logo_url"
                        defaultValue={r.organization!.settings?.logo_url ?? ""}
                        placeholder="https://…"
                        className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </label>
                  </div>
                </div>
                <button className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
                  Save
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
