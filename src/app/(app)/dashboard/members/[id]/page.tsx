import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateMemberStatus, assignDocument, signMemberDocument, assignSubscription, updateMemberNotes, updateSubscriptionStatus, renewSubscription, logMeasurement, awardPoints, logCommunication, createMemberInvoice, checkInMember, checkOutMember, updateMemberDetails, removeMemberDocument, addMemberToGroup, removeMemberFromGroup, rotateCheckInCode, deleteMember } from "../actions";
import { DeleteMemberButton } from "@/components/DeleteMemberButton";
import { MEMBER_STATUSES } from "@/lib/members";
import { DOCUMENT_KINDS } from "@/lib/documents";
import { formatMoney, SUBSCRIPTION_STATUSES } from "@/lib/billing";

export const dynamic = "force-dynamic";

type Member = {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  member_since: string;
  member_number: string | null;
  date_of_birth: string | null;
  qr_token: string | null;
  notes: string | null;
  organization: { name: string } | null;
};

type DocTemplate = { id: string; title: string; kind: string };
type MemberDoc = { id: string; kind: string; status: string; signed_at: string | null };
type PlanOpt = { id: string; name: string; price_cents: number; currency: string; interval: string };
type Subscription = { id: string; status: string; current_period_end: string | null; plan: { name: string } | null };
type Measurement = { id: string; recorded_at: string; weight_kg: number | null; body_fat_pct: number | null };
type Communication = { id: string; channel: string; body: string | null; created_at: string };
type Invoice = { id: string; amount_cents: number; currency: string; status: string; due_date: string | null };
type Group = { id: string; name: string; group_type: string };
type GroupLink = { id: string; relationship: string | null; group: { name: string } | null };

type Evt = {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
};

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const { error, ok } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS scopes this to the caller's tenant; a foreign id simply returns nothing.
  const { data: memberData } = await supabase
    .from("members")
    .select(
      "id, organization_id, first_name, last_name, email, phone, status, member_since, member_number, date_of_birth, qr_token, notes, organization:organizations(name)",
    )
    .eq("id", id)
    .maybeSingle();
  const member = memberData as unknown as Member | null;

  if (!member) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-8">
        <Link href="/dashboard/members" className="text-sm text-ash hover:underline">
          ← Members
        </Link>
        <p className="rounded-md border border-onyx bg-onyx p-6 text-center text-sm text-ash ">
          Member not found (or not in your gym).
        </p>
      </main>
    );
  }

  const { data: eventsData } = await supabase
    .from("events")
    .select("id, event_type, payload, occurred_at")
    .eq("subject_type", "member")
    .eq("subject_id", id)
    .order("occurred_at", { ascending: false })
    .limit(20);
  const events = (eventsData ?? []) as unknown as Evt[];

  const { data: tplData } = await supabase
    .from("document_templates")
    .select("id, title, kind")
    .eq("organization_id", member.organization_id)
    .eq("active", true)
    .order("title", { ascending: true });
  const templates = (tplData ?? []) as unknown as DocTemplate[];

  const { data: docData } = await supabase
    .from("member_documents")
    .select("id, kind, status, signed_at")
    .eq("member_id", id)
    .order("created_at", { ascending: false });
  const memberDocs = (docData ?? []) as unknown as MemberDoc[];

  const { data: planData } = await supabase
    .from("plans")
    .select("id, name, price_cents, currency, interval")
    .eq("organization_id", member.organization_id)
    .eq("active", true)
    .order("price_cents", { ascending: true });
  const plans = (planData ?? []) as unknown as PlanOpt[];

  const { data: subData } = await supabase
    .from("subscriptions")
    .select("id, status, current_period_end, plan:plans(name)")
    .eq("member_id", id)
    .order("created_at", { ascending: false });
  const subscriptions = (subData ?? []) as unknown as Subscription[];

  const { data: measureData } = await supabase
    .from("member_measurements")
    .select("id, recorded_at, weight_kg, body_fat_pct")
    .eq("member_id", id)
    .order("recorded_at", { ascending: false })
    .limit(12);
  const measurements = (measureData ?? []) as unknown as Measurement[];

  const { data: loyaltyData } = await supabase
    .from("loyalty_transactions")
    .select("points")
    .eq("member_id", id)
    .limit(1000);
  const loyaltyBalance = ((loyaltyData ?? []) as { points: number }[]).reduce(
    (sum, r) => sum + (r.points ?? 0),
    0,
  );

  const { data: commsData } = await supabase
    .from("member_communications")
    .select("id, channel, body, created_at")
    .eq("member_id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  const communications = (commsData ?? []) as unknown as Communication[];

  const { data: invoiceData } = await supabase
    .from("invoices")
    .select("id, amount_cents, currency, status, due_date")
    .eq("member_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  const invoices = (invoiceData ?? []) as unknown as Invoice[];
  const outstanding = invoices
    .filter((inv) => inv.status === "open" || inv.status === "past_due")
    .reduce((sum, inv) => sum + (inv.amount_cents ?? 0), 0);

  const { data: lastVisitData } = await supabase
    .from("checkins")
    .select("checked_in_at")
    .eq("member_id", id)
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastVisit = (lastVisitData as { checked_in_at: string } | null)?.checked_in_at ?? null;

  const age = member.date_of_birth
    ? Math.floor((new Date().getTime() - Date.parse(member.date_of_birth)) / (365.25 * 24 * 3600 * 1000))
    : null;

  const { data: openCheckin } = await supabase
    .from("checkins")
    .select("id")
    .eq("member_id", id)
    .is("checked_out_at", null)
    .limit(1)
    .maybeSingle();
  const openCheckinId = (openCheckin as { id: string } | null)?.id ?? null;

  const { data: groupData } = await supabase
    .from("member_groups")
    .select("id, name, group_type")
    .eq("organization_id", member.organization_id)
    .order("name", { ascending: true })
    .limit(200);
  const groups = (groupData ?? []) as unknown as Group[];

  const { data: linkData } = await supabase
    .from("member_group_links")
    .select("id, relationship, group:member_groups(name)")
    .eq("member_id", id);
  const groupLinks = (linkData ?? []) as unknown as GroupLink[];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard/members" className="text-sm text-ash hover:underline">
          ← Members
        </Link>
        <h1 className="mt-1 text-h1 text-bone">
          {member.first_name} {member.last_name}
        </h1>
        <p className="text-sm text-ash">
          {member.organization?.name ?? "—"} · member since {member.member_since}
          {member.member_number ? ` · #${member.member_number}` : ""}
          {age != null ? ` · age ${age}` : ""}
          {lastVisit ? ` · last visit ${new Date(lastVisit).toLocaleDateString()}` : " · no visits yet"}
        </p>
        {openCheckinId ? (
          <form action={checkOutMember} className="mt-2">
            <input type="hidden" name="id" value={openCheckinId} />
            <input type="hidden" name="member_id" value={member.id} />
            <button className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold">
              Check out (in the gym now)
            </button>
          </form>
        ) : (
          <form action={checkInMember} className="mt-2">
            <input type="hidden" name="organization_id" value={member.organization_id} />
            <input type="hidden" name="member_id" value={member.id} />
            <button className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
              Check in now
            </button>
          </form>
        )}
      </div>

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
          {error}
        </p>
      ) : null}

      {ok ? (
        <p className="rounded-md border border-l-2 border-onyx border-l-gold px-3 py-2 text-sm text-gold">
          {ok}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ash">Details</h2>
        <form action={updateMemberDetails} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={member.id} />
          <div className="flex gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="text-xs text-ash">First name</span>
              <input name="first_name" required defaultValue={member.first_name} className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2" />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="text-xs text-ash">Last name</span>
              <input name="last_name" required defaultValue={member.last_name} className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2" />
            </label>
          </div>
          <div className="flex gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="text-xs text-ash">Email</span>
              <input name="email" type="email" defaultValue={member.email ?? ""} className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2" />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="text-xs text-ash">Phone</span>
              <input name="phone" defaultValue={member.phone ?? ""} className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2" />
            </label>
          </div>
          <div className="flex gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="text-xs text-ash">Member #</span>
              <input name="member_number" defaultValue={member.member_number ?? ""} className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2" />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="text-xs text-ash">Date of birth</span>
              <input name="date_of_birth" type="date" defaultValue={member.date_of_birth ?? ""} className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2" />
            </label>
          </div>
          <button className="self-start rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold">
            Save details
          </button>
        </form>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-ash">Check-in QR token</div>
            <div className="font-mono text-xs break-all">{member.qr_token ?? "—"}</div>
          </div>
          <form action={rotateCheckInCode}>
            <input type="hidden" name="id" value={member.id} />
            <button
              className="shrink-0 rounded-md border border-iron px-3 py-1.5 text-xs font-medium hover:border-gold hover:text-gold"
              title="Issue a new code and immediately revoke the old one (lost card / photographed code)"
            >
              Regenerate
            </button>
          </form>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Status</h2>
        <form action={updateMemberStatus} className="flex items-center gap-2">
          <input type="hidden" name="id" value={member.id} />
          <select
            name="status"
            defaultValue={member.status}
            className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2"
          >
            {MEMBER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold">
            Update
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Notes</h2>
        <form action={updateMemberNotes} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={member.id} />
          <textarea
            name="notes"
            rows={3}
            defaultValue={member.notes ?? ""}
            placeholder="Staff notes about this member…"
            className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2"
          />
          <button className="self-start rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold">
            Save notes
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ash">Membership</h2>
        {subscriptions.length === 0 ? (
          <p className="text-sm text-ash">No subscription.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {subscriptions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-md border border-iron px-3 py-2"
              >
                <span className="flex flex-col">
                  <span>{s.plan?.name ?? "(no plan)"}</span>
                  {s.current_period_end ? (
                    <span className="text-xs text-ash">
                      renews {new Date(s.current_period_end).toLocaleDateString()}
                    </span>
                  ) : null}
                </span>
                <form action={updateSubscriptionStatus} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="member_id" value={member.id} />
                  <select
                    name="status"
                    defaultValue={s.status}
                    className="rounded-md border border-iron px-2 py-1 text-xs bg-onyx-2"
                  >
                    {SUBSCRIPTION_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-md border border-iron px-2 py-1 text-xs font-medium hover:bg-onyx-2 hover:bg-onyx-2">
                    Update
                  </button>
                </form>
                <form action={renewSubscription}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="member_id" value={member.id} />
                  <button className="rounded-md border border-iron px-2 py-1 text-xs font-medium hover:bg-onyx-2 hover:bg-onyx-2">
                    Renew
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {plans.length > 0 ? (
          <form action={assignSubscription} className="flex items-center gap-2">
            <input type="hidden" name="organization_id" value={member.organization_id} />
            <input type="hidden" name="member_id" value={member.id} />
            <select name="plan_id" required className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatMoney(p.price_cents, p.currency)}/{p.interval}
                </option>
              ))}
            </select>
            <button className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold">
              Assign plan
            </button>
          </form>
        ) : (
          <p className="text-xs text-ash">
            No active plans yet — create one under Plans.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ash">Documents</h2>
        {memberDocs.length === 0 ? (
          <p className="text-sm text-ash">No documents assigned.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {memberDocs.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-md border border-iron px-3 py-2"
              >
                <span>
                  {d.kind} · <span className="text-ash">{d.status}</span>
                </span>
                <span className="flex items-center gap-2">
                  {d.status === "pending" ? (
                    <form action={signMemberDocument}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="member_id" value={member.id} />
                      <button className="rounded-md border border-iron px-3 py-1 text-xs font-medium hover:bg-onyx-2 hover:bg-onyx-2">
                        Mark signed
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-ash">
                      {d.signed_at ? new Date(d.signed_at).toLocaleDateString() : ""}
                    </span>
                  )}
                  <form action={removeMemberDocument}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="member_id" value={member.id} />
                    <button className="text-xs text-red-600 hover:underline dark:text-red-400">
                      Remove
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
        <form action={assignDocument} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="organization_id" value={member.organization_id} />
          <input type="hidden" name="member_id" value={member.id} />
          <select name="template_id" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
            <option value="">(no template)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <select name="kind" defaultValue="waiver" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">
            {DOCUMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <button className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold">
            Assign document
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ash">Progress</h2>
        {measurements.length === 0 ? (
          <p className="text-sm text-ash">No measurements logged.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {measurements.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-md border border-iron px-3 py-2"
              >
                <span>{m.recorded_at}</span>
                <span className="text-xs text-ash">
                  {m.weight_kg != null ? `${m.weight_kg} kg` : ""}
                  {m.weight_kg != null && m.body_fat_pct != null ? " · " : ""}
                  {m.body_fat_pct != null ? `${m.body_fat_pct}% bf` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <form action={logMeasurement} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="organization_id" value={member.organization_id} />
          <input type="hidden" name="member_id" value={member.id} />
          <input name="weight_kg" type="number" step="0.1" min="0" placeholder="Weight kg" className="w-28 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <input name="body_fat_pct" type="number" step="0.1" min="0" placeholder="Body fat %" className="w-28 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <button className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold">
            Log
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ash">Billing</h2>
        <div className="flex items-center justify-between rounded-md border border-iron px-4 py-3">
          <span className="text-sm text-ash">Outstanding</span>
          <span className="text-lg font-semibold">{formatMoney(outstanding)}</span>
        </div>
        {invoices.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between rounded-md border border-iron px-3 py-2">
                <span>{formatMoney(inv.amount_cents, inv.currency)}</span>
                <span className="text-xs text-ash">
                  {inv.status}
                  {inv.due_date ? ` · due ${inv.due_date}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <form action={createMemberInvoice} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="organization_id" value={member.organization_id} />
          <input type="hidden" name="member_id" value={member.id} />
          <input name="amount" type="number" min="0" step="0.01" placeholder="Amount" className="w-28 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <input name="due_date" type="date" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <button className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold">
            Invoice
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ash">Groups</h2>
        {groupLinks.length === 0 ? (
          <p className="text-sm text-ash">Not in any group.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {groupLinks.map((g) => (
              <li key={g.id} className="flex items-center justify-between rounded-md border border-iron px-3 py-2">
                <span>
                  {g.group?.name ?? "(group)"}
                  {g.relationship ? <span className="text-xs text-ash"> · {g.relationship}</span> : null}
                </span>
                <form action={removeMemberFromGroup}>
                  <input type="hidden" name="id" value={g.id} />
                  <input type="hidden" name="member_id" value={member.id} />
                  <button className="text-xs text-red-600 hover:underline dark:text-red-400">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {groups.length > 0 ? (
          <form action={addMemberToGroup} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="organization_id" value={member.organization_id} />
            <input type="hidden" name="member_id" value={member.id} />
            <select name="group_id" required className="rounded-md border border-iron px-2 py-2 text-sm bg-onyx-2">
              <option value="">— group —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.group_type})
                </option>
              ))}
            </select>
            <input name="relationship" placeholder="Relationship (e.g. parent)" className="flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
            <button className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold">
              Add to group
            </button>
          </form>
        ) : (
          <p className="text-xs text-ash">No groups yet — create one under Groups.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Loyalty</h2>
        <div className="flex items-center justify-between rounded-md border border-iron px-4 py-3">
          <span className="text-sm text-ash">Balance</span>
          <span className="text-lg font-semibold">{loyaltyBalance} pts</span>
        </div>
        <form action={awardPoints} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="organization_id" value={member.organization_id} />
          <input type="hidden" name="member_id" value={member.id} />
          <input name="points" type="number" placeholder="Points (+/-)" className="w-28 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <input name="reason" placeholder="Reason" className="flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <button className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold">
            Adjust
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ash">Communication</h2>
        {communications.length === 0 ? (
          <p className="text-sm text-ash">No communications logged.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {communications.map((c) => (
              <li key={c.id} className="rounded-md border border-iron px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase text-ash">{c.channel}</span>
                  <span className="text-xs text-ash">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
                {c.body ? <p className="mt-0.5">{c.body}</p> : null}
              </li>
            ))}
          </ul>
        )}
        <form action={logCommunication} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="organization_id" value={member.organization_id} />
          <input type="hidden" name="member_id" value={member.id} />
          <select name="channel" defaultValue="note" className="rounded-md border border-iron px-2 py-2 text-sm bg-onyx-2">
            {["note", "email", "sms", "call"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input name="body" placeholder="Message…" className="flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
          <button className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold">
            Log
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">History</h2>
        {events.length === 0 ? (
          <p className="text-sm text-ash">No events yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-md border border-iron px-3 py-2"
              >
                <span className="font-mono text-xs">{e.event_type}</span>
                <span className="text-xs text-ash">
                  {new Date(e.occurred_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-2 flex flex-col gap-2 rounded-md border border-loss/30 p-4">
        <h2 className="text-sm font-medium text-loss">Danger zone</h2>
        <p className="text-xs text-ash">Permanently delete this member and all of their history (bookings, check-ins, measurements). This cannot be undone — to keep the record, set their status to “cancelled” instead.</p>
        <DeleteMemberButton action={deleteMember} id={member.id} name={`${member.first_name} ${member.last_name}`} />
      </section>
    </main>
  );
}
