import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { createPost, addComment } from "./actions";

export const dynamic = "force-dynamic";

type Comment = { id: string; body: string; created_at: string; author: { full_name: string | null } | null };
type Post = {
  id: string;
  organization_id: string;
  title: string | null;
  body: string;
  created_at: string;
  author: { full_name: string | null } | null;
  community_comments: Comment[];
};

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgs = await getWritableOrgs(supabase);
  const { data: postData } = await supabase
    .from("community_posts")
    .select("id, organization_id, title, body, created_at, author:profiles(full_name), community_comments(id, body, created_at, author:profiles(full_name))")
    .order("created_at", { ascending: false })
    .limit(50);
  const posts = (postData ?? []) as unknown as Post[];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">← Dashboard</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Community</h1>
        <p className="text-sm text-zinc-500">Post updates and discuss with your members.</p>
      </div>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p> : null}

      {orgs.length > 0 ? (
        <form action={createPost} className="flex flex-col gap-2 rounded-md border border-onyx bg-onyx p-5">
          <OrgPicker orgs={orgs} />
          <input name="title" placeholder="Title (optional)" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          <textarea name="body" rows={3} required placeholder="Share something with the community…" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Post</button>
        </form>
      ) : null}

      <section className="flex flex-col gap-4">
        {posts.length === 0 ? (
          <p className="text-sm text-zinc-500">No posts yet.</p>
        ) : (
          posts.map((p) => (
            <article key={p.id} className="rounded-md border border-onyx bg-onyx p-4">
              {p.title ? <h3 className="font-display font-bold">{p.title}</h3> : null}
              <p className="mt-1 text-sm">{p.body}</p>
              <p className="mt-1 text-xs text-zinc-500">{p.author?.full_name ?? "Staff"} · {new Date(p.created_at).toLocaleString()}</p>

              <div className="mt-3 flex flex-col gap-2 border-t border-iron pt-3">
                {p.community_comments
                  .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
                  .map((c) => (
                    <div key={c.id} className="text-sm">
                      <span className="text-xs text-gold">{c.author?.full_name ?? "Member"}</span>{" "}
                      <span>{c.body}</span>
                    </div>
                  ))}
                <form action={addComment} className="flex gap-2">
                  <input type="hidden" name="organization_id" value={p.organization_id} />
                  <input type="hidden" name="post_id" value={p.id} />
                  <input name="body" required placeholder="Reply…" className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
                  <button className="rounded-md border border-iron px-3 py-1 text-xs font-medium hover:border-gold hover:text-gold">Reply</button>
                </form>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
