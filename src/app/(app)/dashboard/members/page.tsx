import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MEMBER_STATUSES } from "@/lib/members";

export const dynamic = "force-dynamic";

type MemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  status: string;
  organization: { name: string } | null;
};

const PAGE_SIZE = 50;

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const { q, page: pageRaw, status: statusRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const status = (MEMBER_STATUSES as readonly string[]).includes(statusRaw ?? "")
    ? (statusRaw as string)
    : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let query = supabase
    .from("members")
    .select("id, first_name, last_name, email, status, organization:organizations(name)")
    .order("last_name", { ascending: true })
    .range(from, to);

  const term = (q ?? "").trim().replace(/[%,*()]/g, "");
  if (term) {
    query = query.or(
      `first_name.ilike.*${term}*,last_name.ilike.*${term}*,email.ilike.*${term}*`,
    );
  }
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  const members = (data ?? []) as unknown as MemberRow[];

  const qs = (p: number) =>
    `?${new URLSearchParams({
      ...(term ? { q: term } : {}),
      ...(status ? { status } : {}),
      page: String(p),
    }).toString()}`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Members</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Plain <a>: this is a file-download route handler, not a page — a
              client-side <Link> would try to render the CSV instead of downloading. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/dashboard/members/export"
            className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold"
          >
            Export CSV
          </a>
          <Link
            href="/dashboard/members/import"
            className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold"
          >
            Import
          </Link>
          <Link
            href="/dashboard/members/new"
            className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90"
          >
            Add member
          </Link>
        </div>
      </header>

      <form className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or email…"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          name="status"
          defaultValue={status}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">All statuses</option>
          {MEMBER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold">
          Search
        </button>
      </form>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Could not load members: {error.message}
        </p>
      ) : members.length === 0 ? (
        <div className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-zinc-500 ">
          {term ? "No members match your search." : "No members yet. Add your first one."}
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx dark:divide-onyx dark:border-onyx">
          {members.map((m) => (
            <li key={m.id}>
              <Link
                href={`/dashboard/members/${m.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <span className="flex flex-col">
                  <span className="font-medium">
                    {m.last_name}, {m.first_name}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {m.email ?? "—"}
                    {m.organization?.name ? ` · ${m.organization.name}` : ""}
                  </span>
                </span>
                <span className="text-xs text-zinc-500">{m.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(page > 1 || members.length === PAGE_SIZE) ? (
        <nav className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={qs(page - 1)} className="text-gold hover:underline">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-zinc-500">Page {page}</span>
          {members.length === PAGE_SIZE ? (
            <Link href={qs(page + 1)} className="text-gold hover:underline">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}
