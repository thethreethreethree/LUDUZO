import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { postAnnouncement, deleteAnnouncement } from "./actions";

export const dynamic = "force-dynamic";

const POST_ROLES = ["owner", "admin", "manager"];

type AnnouncementRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  organization: { name: string } | null;
};

export default async function AnnouncementsPage({
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
    .from("announcements")
    .select("id, title, body, created_at, organization:organizations(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  const announcements = (data ?? []) as unknown as AnnouncementRow[];
  const orgs = await getWritableOrgs(supabase, POST_ROLES);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-h1 text-bone">Announcements</h1>
      </div>

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
          {error}
        </p>
      ) : null}

      {orgs.length > 0 ? (
        <form action={postAnnouncement} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-4">
          <h2 className="text-sm font-medium">Post an announcement</h2>
          <OrgPicker orgs={orgs} />
          <input name="title" required placeholder="Title" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <textarea name="body" rows={3} placeholder="Message (optional)" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
            Post
          </button>
        </form>
      ) : null}

      {announcements.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-ash ">
          No announcements yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {announcements.map((a) => (
            <li key={a.id} className="rounded-md border border-onyx bg-onyx p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{a.title}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-ash">
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                  {orgs.length > 0 ? (
                    <form action={deleteAnnouncement}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="text-xs font-medium text-red-600 hover:underline dark:text-red-400">
                        Delete
                      </button>
                    </form>
                  ) : null}
                </span>
              </div>
              {a.body ? <p className="mt-1 text-sm text-ash dark:text-ash">{a.body}</p> : null}
              {a.organization?.name ? (
                <p className="mt-1 text-xs text-ash">{a.organization.name}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
