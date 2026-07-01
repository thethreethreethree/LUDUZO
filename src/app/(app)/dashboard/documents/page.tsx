import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { DOCUMENT_KINDS } from "@/lib/documents";
import { OrgPicker } from "@/components/OrgPicker";
import { createTemplate, toggleTemplateActive } from "./actions";

export const dynamic = "force-dynamic";

type TemplateRow = {
  id: string;
  title: string;
  kind: string;
  active: boolean;
  organization: { name: string } | null;
};

export default async function DocumentsPage({
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
    .from("document_templates")
    .select("id, title, kind, active, organization:organizations(name)")
    .order("title", { ascending: true })
    .limit(200);
  const templates = (data ?? []) as unknown as TemplateRow[];
  const orgs = await getWritableOrgs(supabase);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-h1 text-bone">
          Document templates
        </h1>
        <p className="text-sm text-ash">
          Waivers, contracts, and policies. Assign them to members from a member&apos;s page.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
          {error}
        </p>
      ) : null}

      {templates.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-ash ">
          No templates yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between px-4 py-3">
              <span className="flex flex-col">
                <span className="font-medium">{t.title}</span>
                <span className="text-xs text-ash">
                  {t.organization?.name ? `${t.organization.name} · ` : ""}
                  {t.kind}
                </span>
              </span>
              {orgs.length > 0 ? (
                <form action={toggleTemplateActive}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="active" value={String(t.active)} />
                  <button className="rounded-md border border-iron px-2 py-1 text-xs font-medium hover:bg-onyx-2 hover:bg-onyx-2">
                    {t.active ? "Deactivate" : "Activate"}
                  </button>
                </form>
              ) : (
                <span className="text-xs text-ash">{t.active ? "active" : "inactive"}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {orgs.length > 0 ? (
        <form action={createTemplate} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-4">
          <h2 className="text-sm font-medium">New template</h2>
          <OrgPicker orgs={orgs} />
          <div className="flex gap-3">
            <input name="title" required placeholder="Title (e.g. Liability Waiver)" className="flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            <select name="kind" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
              {DOCUMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <textarea name="body" rows={4} placeholder="Template text (optional)" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
            Create template
          </button>
        </form>
      ) : (
        <p className="text-sm text-ash">
          You need a staff role in a gym to create templates.
        </p>
      )}
    </main>
  );
}
