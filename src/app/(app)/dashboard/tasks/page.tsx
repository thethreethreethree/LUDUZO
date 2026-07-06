import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/lib/team";
import { createTask, updateTaskStatus } from "./actions";

export const dynamic = "force-dynamic";

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  assignee: { full_name: string | null } | null;
};
type StaffOpt = { user_id: string; profile: { full_name: string | null } | null };

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "text-loss",
  high: "text-gold",
  normal: "text-ash",
  low: "text-ash",
};

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgs = await getWritableOrgs(supabase);

  const { data: taskData } = await supabase
    .from("tasks")
    .select("id, title, description, due_date, priority, status, assignee:profiles!tasks_assigned_to_fkey(full_name)")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(100);
  const tasks = (taskData ?? []) as unknown as Task[];

  const { data: staffData } = await supabase
    .from("organization_members")
    .select("user_id, profile:profiles(full_name)")
    .limit(200);
  const staff = (staffData ?? []) as unknown as StaffOpt[];

  const openCount = tasks.filter((t) => t.status !== "done").length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">← Dashboard</Link>
        <h1 className="mt-1 text-h1 text-bone">Tasks</h1>
        <p className="text-sm text-ash">{openCount} open · assign work across the team.</p>
      </div>

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>
      ) : null}

      {orgs.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-ash">You don&apos;t manage any gym.</p>
      ) : (
        <form action={createTask} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-5">
          <OrgPicker orgs={orgs} />
          <input name="title" aria-label="Task title" required placeholder="Task title" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <textarea name="description" aria-label="Task details" rows={2} placeholder="Details (optional)" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <div className="flex gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ash">Assign to
              <select name="assigned_to" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
                <option value="">— unassigned —</option>
                {staff.map((s) => (<option key={s.user_id} value={s.user_id}>{s.profile?.full_name ?? "(staff)"}</option>))}
              </select>
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ash">Priority
              <select name="priority" defaultValue="normal" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
                {TASK_PRIORITIES.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ash">Due
              <input name="due_date" type="date" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            </label>
          </div>
          <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Create task</button>
        </form>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-ash">No tasks.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx">
            {tasks.map((t) => (
              <li key={t.id} className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${t.status === "done" ? "opacity-60" : ""}`}>
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">{t.title}</span>
                  <span className="text-xs text-ash">
                    <span className={PRIORITY_COLOR[t.priority] ?? ""}>{t.priority}</span>
                    {t.assignee?.full_name ? ` · ${t.assignee.full_name}` : " · unassigned"}
                    {t.due_date ? ` · due ${t.due_date}` : ""}
                  </span>
                </div>
                <form action={updateTaskStatus} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <select name="status" aria-label={`Status for ${t.title}`} defaultValue={t.status} className="rounded-md border border-iron bg-transparent px-2 py-1 text-xs">
                    {TASK_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                  <button className="rounded-md border border-iron px-2 py-1 text-xs font-medium hover:border-gold hover:text-gold">Save</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
