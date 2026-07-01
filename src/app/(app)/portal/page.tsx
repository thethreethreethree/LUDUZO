import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/billing";
import { claimRecords, signMyDocument, portalSignOut } from "./actions";

export const dynamic = "force-dynamic";

type MyMember = { id: string; first_name: string; last_name: string; qr_token: string | null; organization: { name: string } | null };
type Sub = { id: string; status: string; current_period_end: string | null; plan: { name: string } | null };
type Measure = { id: string; recorded_at: string; weight_kg: number | null };
type Visit = { id: string; checked_in_at: string };
type Doc = { id: string; kind: string; status: string };
type Announcement = { id: string; title: string; body: string | null; created_at: string };
type Booking = { id: string; status: string; session: { starts_at: string; class: { name: string } | null } | null };
type GroupLink = { id: string; relationship: string | null; group: { name: string; group_type: string } | null };

export default async function PortalPage({
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

  const { data: memberData } = await supabase
    .from("members")
    .select("id, first_name, last_name, qr_token, organization:organizations(name)")
    .eq("profile_id", user.id);
  const members = (memberData ?? []) as unknown as MyMember[];
  const memberIds = members.map((m) => m.id);

  // Gym announcements the member may read (migration 0019 member-scoped policy).
  const { data: annData } = await supabase
    .from("announcements")
    .select("id, title, body, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  const announcements = (annData ?? []) as unknown as Announcement[];

  let subs: Sub[] = [];
  let measures: Measure[] = [];
  let visits: Visit[] = [];
  let docs: Doc[] = [];
  let bookings: Booking[] = [];
  let groupLinks: GroupLink[] = [];
  let loyaltyBalance = 0;
  let outstanding = 0;
  if (memberIds.length > 0) {
    const { data: subData } = await supabase
      .from("subscriptions")
      .select("id, status, current_period_end, plan:plans(name)")
      .in("member_id", memberIds);
    subs = (subData ?? []) as unknown as Sub[];
    const { data: mData } = await supabase
      .from("member_measurements")
      .select("id, recorded_at, weight_kg")
      .in("member_id", memberIds)
      .order("recorded_at", { ascending: false })
      .limit(12);
    measures = (mData ?? []) as unknown as Measure[];
    const { data: loyData } = await supabase
      .from("loyalty_transactions")
      .select("points")
      .in("member_id", memberIds)
      .limit(1000);
    loyaltyBalance = ((loyData ?? []) as { points: number }[]).reduce((s, r) => s + (r.points ?? 0), 0);

    const { data: invData } = await supabase
      .from("invoices")
      .select("amount_cents, status")
      .in("member_id", memberIds)
      .limit(500);
    outstanding = ((invData ?? []) as { amount_cents: number; status: string }[])
      .filter((i) => i.status === "open" || i.status === "past_due")
      .reduce((s, i) => s + (i.amount_cents ?? 0), 0);

    const { data: visitData } = await supabase
      .from("checkins")
      .select("id, checked_in_at")
      .in("member_id", memberIds)
      .order("checked_in_at", { ascending: false })
      .limit(10);
    visits = (visitData ?? []) as unknown as Visit[];

    const { data: docData } = await supabase
      .from("member_documents")
      .select("id, kind, status")
      .in("member_id", memberIds)
      .order("created_at", { ascending: false })
      .limit(20);
    docs = (docData ?? []) as unknown as Doc[];

    const { data: bookingData } = await supabase
      .from("bookings")
      .select("id, status, session:class_sessions(starts_at, class:classes(name))")
      .in("member_id", memberIds)
      .order("created_at", { ascending: false })
      .limit(20);
    bookings = (bookingData ?? []) as unknown as Booking[];

    const { data: linkData } = await supabase
      .from("member_group_links")
      .select("id, relationship, group:member_groups(name, group_type)")
      .in("member_id", memberIds);
    groupLinks = (linkData ?? []) as unknown as GroupLink[];
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <Image src="/brand/luduzo_helmet_white.svg" alt="LUDUZO" width={24} height={24} />
            <span className="font-display font-extrabold tracking-widest">LUDUZO</span>
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">My membership</h1>
          <p className="text-sm text-zinc-500">{user.email}</p>
        </div>
        <form action={portalSignOut}>
          <button className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold">
            Sign out
          </button>
        </form>
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {announcements.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-zinc-500">Gym news</h2>
          <ul className="flex flex-col gap-2">
            {announcements.map((a) => (
              <li key={a.id} className="rounded-md border border-zinc-200 border-l-2 border-l-gold p-3 dark:border-zinc-800">
                <div className="text-sm font-medium">{a.title}</div>
                {a.body ? <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{a.body}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {members.length === 0 ? (
        <div className="rounded-md border border-onyx bg-onyx p-6 text-center">
          <p className="text-sm text-zinc-400">
            We couldn&apos;t find a membership linked to your account.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            If your gym has your email on file, link it now.
          </p>
          <form action={claimRecords} className="mt-3">
            <button className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
              Find my membership
            </button>
          </form>
          <div className="mt-4 border-t border-iron pt-4">
            <p className="text-xs text-zinc-500">Run a gym instead?</p>
            <Link
              href="/onboarding"
              className="mt-2 inline-block rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold"
            >
              Set up your gym →
            </Link>
          </div>
        </div>
      ) : (
        <>
          {members.map((m) => (
            <section key={m.id} className="flex flex-col gap-1 rounded-md border border-onyx bg-onyx p-4">
              <span className="font-medium">
                {m.first_name} {m.last_name}
              </span>
              <span className="text-xs text-zinc-500">{m.organization?.name ?? ""}</span>
              {m.qr_token ? (
                <span className="mt-1 text-xs text-zinc-500">
                  Check-in code: <span className="font-mono break-all">{m.qr_token}</span>
                </span>
              ) : null}
            </section>
          ))}

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-zinc-500">Membership</h2>
            {subs.length === 0 ? (
              <p className="text-sm text-zinc-500">No active plan.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {subs.map((s) => (
                  <li key={s.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                    <span className="flex flex-col">
                      <span>{s.plan?.name ?? "(plan)"}</span>
                      {s.current_period_end ? (
                        <span className="text-xs text-zinc-500">
                          renews {new Date(s.current_period_end).toLocaleDateString()}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-zinc-500">{s.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <span className="text-sm text-zinc-500">Loyalty</span>
              <span className="text-lg font-semibold">{loyaltyBalance} pts</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <span className="text-sm text-zinc-500">Balance due</span>
              <span className="text-lg font-semibold">{formatMoney(outstanding)}</span>
            </div>
          </div>

          {groupLinks.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-zinc-500">My group</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {groupLinks.map((g) => (
                  <li key={g.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                    <span>{g.group?.name ?? "(group)"}</span>
                    <span className="text-xs text-zinc-500">
                      {g.group?.group_type}
                      {g.relationship ? ` · ${g.relationship}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-zinc-500">My classes</h2>
            {bookings.length === 0 ? (
              <p className="text-sm text-zinc-500">No class bookings.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {bookings.map((b) => (
                  <li key={b.id} className="flex items-center justify-between rounded-md border border-zinc-200 border-l-2 border-l-gold px-3 py-2 dark:border-zinc-800">
                    <span className="flex flex-col">
                      <span>{b.session?.class?.name ?? "(class)"}</span>
                      {b.session?.starts_at ? (
                        <span className="text-xs text-zinc-500">
                          {new Date(b.session.starts_at).toLocaleString()}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-zinc-500">{b.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-zinc-500">My documents</h2>
            {docs.length === 0 ? (
              <p className="text-sm text-zinc-500">No documents.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                    <span>{d.kind}</span>
                    {d.status === "signed" ? (
                      <span className="text-xs text-green-600 dark:text-green-400">signed</span>
                    ) : (
                      <form action={signMyDocument}>
                        <input type="hidden" name="id" value={d.id} />
                        <button className="rounded-md bg-gold px-3 py-1 text-xs font-medium text-black hover:opacity-90">
                          Sign
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-zinc-500">Recent visits</h2>
            {visits.length === 0 ? (
              <p className="text-sm text-zinc-500">No visits yet.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {visits.map((v) => (
                  <li key={v.id} className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                    {new Date(v.checked_in_at).toLocaleString()}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-zinc-500">My progress</h2>
            {measures.length === 0 ? (
              <p className="text-sm text-zinc-500">No measurements yet.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {measures.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                    <span>{m.recorded_at}</span>
                    <span className="text-xs text-zinc-500">{m.weight_kg != null ? `${m.weight_kg} kg` : "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
