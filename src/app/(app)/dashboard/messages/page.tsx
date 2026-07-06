import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { sendMessage, markRead } from "./actions";

export const dynamic = "force-dynamic";

type Msg = {
  id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  from_user: string;
  to_user: string;
  sender: { full_name: string | null } | null;
  recipient: { full_name: string | null } | null;
};
type StaffOpt = { user_id: string; profile: { full_name: string | null } | null };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgs = await getWritableOrgs(supabase);

  const { data: msgData } = await supabase
    .from("internal_messages")
    .select("id, body, read_at, created_at, from_user, to_user, sender:profiles!internal_messages_from_user_fkey(full_name), recipient:profiles!internal_messages_to_user_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  const messages = (msgData ?? []) as unknown as Msg[];

  const { data: staffData } = await supabase
    .from("organization_members")
    .select("user_id, profile:profiles(full_name)")
    .limit(200);
  const staff = (staffData ?? []) as unknown as StaffOpt[];

  const unread = messages.filter((m) => m.to_user === user.id && !m.read_at).length;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">← Dashboard</Link>
        <h1 className="mt-1 text-h1 text-bone">Team messages</h1>
        <p className="text-sm text-ash">{unread > 0 ? `${unread} unread · ` : ""}Direct messages between staff.</p>
      </div>

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>
      ) : null}

      {orgs.length === 0 ? (
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-ash">You don&apos;t manage any gym.</p>
      ) : (
        <form action={sendMessage} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-5">
          <OrgPicker orgs={orgs} />
          <select name="to_user" aria-label="Recipient" required className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
            <option value="">To…</option>
            {staff.filter((s) => s.user_id !== user.id).map((s) => (
              <option key={s.user_id} value={s.user_id}>{s.profile?.full_name ?? "(staff)"}</option>
            ))}
          </select>
          <textarea name="body" aria-label="Message" rows={2} required placeholder="Message…" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Send</button>
        </form>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Conversations</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-ash">No messages.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((m) => {
              const incoming = m.to_user === user.id;
              return (
                <li key={m.id} className={`rounded-md border px-4 py-3 text-sm ${incoming && !m.read_at ? "border-gold bg-onyx" : "border-onyx bg-onyx"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ash">
                      {incoming ? `${m.sender?.full_name ?? "(staff)"} → you` : `you → ${m.recipient?.full_name ?? "(staff)"}`}
                      {" · "}{new Date(m.created_at).toLocaleString()}
                    </span>
                    {incoming && !m.read_at ? (
                      <form action={markRead}>
                        <input type="hidden" name="id" value={m.id} />
                        <button className="rounded-md border border-iron px-2 py-0.5 text-xs hover:border-gold hover:text-gold">Mark read</button>
                      </form>
                    ) : null}
                  </div>
                  <p className="mt-1">{m.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
