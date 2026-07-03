import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandColorFields } from "@/components/BrandColorFields";
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY, DEFAULT_BACKGROUND } from "@/lib/gymTheme";
import { updateOrganization } from "./actions";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["owner", "admin"];

type Row = {
  role: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    settings: { brand_color?: string; brand_primary?: string; brand_secondary?: string; brand_background?: string; logo_url?: string } | null;
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
        <Link href="/dashboard" className="text-sm text-ash hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-h1 text-bone">Settings</h1>
        <p className="text-sm text-ash">Rename and brand the gyms you own or administer — your colours and logo appear in your members&apos; app.</p>
      </div>

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-win dark:bg-green-950 dark:text-green-300">
          Saved.
        </p>
      ) : null}

      {orgs.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-ash ">
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
                      className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2"
                    />
                    <span className="text-xs text-ash">/{r.organization!.slug}</span>
                  </label>
                  <BrandColorFields
                    primary={r.organization!.settings?.brand_primary ?? r.organization!.settings?.brand_color ?? DEFAULT_PRIMARY}
                    secondary={r.organization!.settings?.brand_secondary ?? DEFAULT_SECONDARY}
                    background={r.organization!.settings?.brand_background ?? DEFAULT_BACKGROUND}
                  />
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Logo</span>
                    <div className="flex items-center gap-3">
                      {r.organization!.settings?.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.organization!.settings.logo_url} alt="Current logo" className="h-10 w-10 rounded border border-iron object-cover" />
                      ) : null}
                      <input
                        type="file"
                        name="logo"
                        accept="image/*"
                        className="min-w-0 flex-1 text-xs text-ash file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-gold file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-black"
                      />
                    </div>
                    <span className="text-xs text-ash-dim">PNG, JPG or SVG under 2 MB. A <b className="text-ash">square</b> image works best — it&apos;s also your app icon when members install the PWA. Leave empty to keep the current logo.</span>
                  </label>
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
