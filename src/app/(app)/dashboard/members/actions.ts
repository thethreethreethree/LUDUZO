"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MEMBER_STATUSES } from "@/lib/members";
import { checkinErrorMessage } from "@/lib/checkins";
import { isUniqueViolation } from "@/lib/pg-errors";

export async function importMembers(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const text = String(formData.get("rows") ?? "");
  if (!organization_id) {
    redirect("/dashboard/members/import?error=" + encodeURIComponent("Pick a gym."));
  }

  // One member per line: first,last,email,phone (email/phone optional).
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [first_name, last_name, email, phone] = line.split(",").map((s) => (s ?? "").trim());
      return { organization_id, first_name, last_name, email: email || null, phone: phone || null };
    })
    .filter((r) => r.first_name && r.last_name);

  if (rows.length === 0) {
    redirect("/dashboard/members/import?error=" + encodeURIComponent("No valid rows (need first,last per line)."));
  }

  const { error } = await supabase.from("members").insert(rows);
  if (error) {
    redirect("/dashboard/members/import?error=" + encodeURIComponent(error.message));
  }
  revalidatePath("/dashboard/members");
  redirect("/dashboard/members");
}

export async function createMember(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const member_number = String(formData.get("member_number") ?? "").trim() || null;
  const date_of_birth = String(formData.get("date_of_birth") ?? "").trim() || null;

  if (!organization_id || !first_name || !last_name) {
    redirect(
      "/dashboard/members/new?error=" +
        encodeURIComponent("Gym, first name, and last name are required."),
    );
  }

  // RLS (members_write) enforces that the user has a staff role in this org.
  const { error } = await supabase
    .from("members")
    .insert({ organization_id, first_name, last_name, email, phone, member_number, date_of_birth });
  if (error) {
    // uq_members_org_number — unique (organization_id, member_number) (0002).
    const msg = isUniqueViolation(error)
      ? "A member with that member number already exists in this gym."
      : error.message;
    redirect("/dashboard/members/new?error=" + encodeURIComponent(msg));
  }

  revalidatePath("/dashboard/members");
  redirect("/dashboard/members");
}

export async function assignDocument(formData: FormData) {
  const supabase = await createClient();
  const organization_id = String(formData.get("organization_id") ?? "");
  const member_id = String(formData.get("member_id") ?? "");
  const template_id = String(formData.get("template_id") ?? "") || null;
  const kind = String(formData.get("kind") ?? "waiver");
  if (!organization_id || !member_id) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent("Missing data."));
  }

  const { error } = await supabase
    .from("member_documents")
    .insert({ organization_id, member_id, template_id, kind, status: "pending" });
  if (error) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/dashboard/members/${member_id}`);
  redirect(`/dashboard/members/${member_id}`);
}

export async function signMemberDocument(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const member_id = String(formData.get("member_id") ?? "");
  if (!id) redirect(`/dashboard/members/${member_id}`);

  // Status change to 'signed' emits a document.signed event (migration 0004 trigger).
  const { error } = await supabase
    .from("member_documents")
    .update({ status: "signed", signed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/dashboard/members/${member_id}`);
  redirect(`/dashboard/members/${member_id}`);
}

export async function assignSubscription(formData: FormData) {
  const supabase = await createClient();
  const organization_id = String(formData.get("organization_id") ?? "");
  const member_id = String(formData.get("member_id") ?? "");
  const plan_id = String(formData.get("plan_id") ?? "");
  if (!organization_id || !member_id || !plan_id) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent("Pick a plan."));
  }

  // Compute the current billing period from the plan's interval.
  const { data: planRow } = await supabase
    .from("plans")
    .select("interval, interval_count")
    .eq("id", plan_id)
    .maybeSingle();
  const plan = planRow as { interval: string; interval_count: number } | null;
  const start = new Date();
  let end: Date | null = new Date(start);
  const count = plan?.interval_count ?? 1;
  switch (plan?.interval) {
    case "day": end!.setDate(end!.getDate() + count); break;
    case "week": end!.setDate(end!.getDate() + 7 * count); break;
    case "month": end!.setMonth(end!.getMonth() + count); break;
    case "year": end!.setFullYear(end!.getFullYear() + count); break;
    default: end = null; break; // one_time or unknown → no period end
  }

  // subscription.created event is emitted by the trigger in migration 0005.
  const { error } = await supabase.from("subscriptions").insert({
    organization_id,
    member_id,
    plan_id,
    status: "active",
    current_period_start: start.toISOString(),
    current_period_end: end ? end.toISOString() : null,
  });
  if (error) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/dashboard/members/${member_id}`);
  redirect(`/dashboard/members/${member_id}`);
}

export async function updateMemberNotes(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const notes = String(formData.get("notes") ?? "");
  if (!id) redirect("/dashboard/members");

  const { error } = await supabase.from("members").update({ notes }).eq("id", id);
  if (error) {
    redirect(`/dashboard/members/${id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/dashboard/members/${id}`);
  redirect(`/dashboard/members/${id}`);
}

export async function renewSubscription(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const member_id = String(formData.get("member_id") ?? "");
  if (!id) redirect(`/dashboard/members/${member_id}`);

  const { data: subRow } = await supabase
    .from("subscriptions")
    .select("current_period_end, plan_id")
    .eq("id", id)
    .maybeSingle();
  const sub = subRow as { current_period_end: string | null; plan_id: string | null } | null;

  let interval = "month";
  let count = 1;
  if (sub?.plan_id) {
    const { data: planRow } = await supabase
      .from("plans")
      .select("interval, interval_count")
      .eq("id", sub.plan_id)
      .maybeSingle();
    const plan = planRow as { interval: string; interval_count: number } | null;
    if (plan) {
      interval = plan.interval;
      count = plan.interval_count ?? 1;
    }
  }

  // Extend from the later of "now" and the current period end (no lost time / no gaps).
  const base = new Date(Math.max(Date.now(), sub?.current_period_end ? Date.parse(sub.current_period_end) : 0));
  const end = new Date(base);
  switch (interval) {
    case "day": end.setDate(end.getDate() + count); break;
    case "week": end.setDate(end.getDate() + 7 * count); break;
    case "month": end.setMonth(end.getMonth() + count); break;
    case "year": end.setFullYear(end.getFullYear() + count); break;
    default: break;
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "active", current_period_end: end.toISOString() })
    .eq("id", id);
  if (error) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/dashboard/members/${member_id}`);
  redirect(`/dashboard/members/${member_id}`);
}

export async function updateSubscriptionStatus(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const member_id = String(formData.get("member_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) redirect(`/dashboard/members/${member_id}`);

  // status change emits subscription.status_changed (migration 0005 trigger).
  const patch: Record<string, unknown> = { status };
  if (status === "canceled") patch.canceled_at = new Date().toISOString();
  const { error } = await supabase.from("subscriptions").update(patch).eq("id", id);
  if (error) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/dashboard/members/${member_id}`);
  redirect(`/dashboard/members/${member_id}`);
}

export async function logMeasurement(formData: FormData) {
  const supabase = await createClient();
  const organization_id = String(formData.get("organization_id") ?? "");
  const member_id = String(formData.get("member_id") ?? "");
  const wRaw = String(formData.get("weight_kg") ?? "").trim();
  const fRaw = String(formData.get("body_fat_pct") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const weight_kg = wRaw && !Number.isNaN(Number(wRaw)) ? Number(wRaw) : null;
  const body_fat_pct = fRaw && !Number.isNaN(Number(fRaw)) ? Number(fRaw) : null;

  if (!organization_id || !member_id) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent("Missing data."));
  }
  const { error } = await supabase
    .from("member_measurements")
    .insert({ organization_id, member_id, weight_kg, body_fat_pct, notes });
  if (error) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/dashboard/members/${member_id}`);
  redirect(`/dashboard/members/${member_id}`);
}

export async function awardPoints(formData: FormData) {
  const supabase = await createClient();
  const organization_id = String(formData.get("organization_id") ?? "");
  const member_id = String(formData.get("member_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const ptsRaw = String(formData.get("points") ?? "").trim();
  const points = ptsRaw && !Number.isNaN(Number(ptsRaw)) ? Math.round(Number(ptsRaw)) : 0;
  if (!organization_id || !member_id || points === 0) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent("Enter a non-zero point amount."));
  }
  const { error } = await supabase
    .from("loyalty_transactions")
    .insert({ organization_id, member_id, points, reason });
  if (error) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/dashboard/members/${member_id}`);
  redirect(`/dashboard/members/${member_id}`);
}

export async function logCommunication(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const member_id = String(formData.get("member_id") ?? "");
  const channel = String(formData.get("channel") ?? "note");
  const body = String(formData.get("body") ?? "").trim() || null;
  if (!organization_id || !member_id || !body) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent("Enter a message."));
  }
  const { error } = await supabase
    .from("member_communications")
    .insert({ organization_id, member_id, channel, body, created_by: user.id });
  if (error) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/dashboard/members/${member_id}`);
  redirect(`/dashboard/members/${member_id}`);
}

export async function createMemberInvoice(formData: FormData) {
  const supabase = await createClient();
  const organization_id = String(formData.get("organization_id") ?? "");
  const member_id = String(formData.get("member_id") ?? "");
  const due_date = String(formData.get("due_date") ?? "").trim() || null;
  const amtRaw = String(formData.get("amount") ?? "").trim();
  const amount_cents = amtRaw && !Number.isNaN(Number(amtRaw)) ? Math.round(Number(amtRaw) * 100) : 0;
  if (!organization_id || !member_id || amount_cents <= 0) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent("Enter a positive amount."));
  }
  const { error } = await supabase
    .from("invoices")
    .insert({ organization_id, member_id, amount_cents, due_date, status: "open" });
  if (error) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/dashboard/members/${member_id}`);
  redirect(`/dashboard/members/${member_id}`);
}

export async function checkInMember(formData: FormData) {
  const supabase = await createClient();
  const organization_id = String(formData.get("organization_id") ?? "");
  const member_id = String(formData.get("member_id") ?? "");
  if (!organization_id || !member_id) redirect("/dashboard/members");

  const { data: openExisting } = await supabase
    .from("checkins")
    .select("id")
    .eq("member_id", member_id)
    .is("checked_out_at", null)
    .limit(1)
    .maybeSingle();
  if (openExisting) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent("Already checked in."));
  }

  const { error } = await supabase
    .from("checkins")
    .insert({ organization_id, member_id, method: "manual" });
  if (error) {
    // Race past the app guard trips uq_checkins_open_member (0018) — friendly message.
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent(checkinErrorMessage(error, "Already checked in.")));
  }
  revalidatePath(`/dashboard/members/${member_id}`);
  redirect(`/dashboard/members/${member_id}`);
}

export async function updateMemberDetails(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const member_number = String(formData.get("member_number") ?? "").trim() || null;
  const date_of_birth = String(formData.get("date_of_birth") ?? "").trim() || null;
  if (!id || !first_name || !last_name) {
    redirect(`/dashboard/members/${id}?error=` + encodeURIComponent("First and last name are required."));
  }
  const { error } = await supabase
    .from("members")
    .update({ first_name, last_name, email, phone, member_number, date_of_birth })
    .eq("id", id);
  if (error) {
    redirect(`/dashboard/members/${id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/dashboard/members/${id}`);
  redirect(`/dashboard/members/${id}`);
}

// Regenerate a member's check-in QR token. This is the revocation path for the stable
// non-expiring token model (0006): if a member's check-in code is photographed or a card
// is lost, staff issue a new one and the old one stops working immediately (the kiosk and
// checkin lookups match on the exact stored token). crypto.randomUUID() matches the DB
// default gen_random_uuid()::text format, so the uq_members_qr_token unique index holds.
// Gated by the members_write RLS policy (owner/admin/manager/front_desk). Matches the
// sibling plain-update pattern; not separately event-logged (the members UPDATE trigger
// only emits on status change) — a dedicated member.qr_rotated audit event would require
// verifying events-insert RLS first, so it is left flagged, not silently added.
export async function rotateCheckInCode(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/dashboard/members");

  const { error } = await supabase
    .from("members")
    .update({ qr_token: crypto.randomUUID() })
    .eq("id", id);
  if (error) {
    redirect(`/dashboard/members/${id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/dashboard/members/${id}`);
  redirect(`/dashboard/members/${id}?ok=` + encodeURIComponent("Check-in code regenerated."));
}

export async function removeMemberDocument(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const member_id = String(formData.get("member_id") ?? "");
  if (!id) redirect(`/dashboard/members/${member_id}`);
  const { error } = await supabase.from("member_documents").delete().eq("id", id);
  if (error) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/dashboard/members/${member_id}`);
  redirect(`/dashboard/members/${member_id}`);
}

export async function addMemberToGroup(formData: FormData) {
  const supabase = await createClient();
  const organization_id = String(formData.get("organization_id") ?? "");
  const member_id = String(formData.get("member_id") ?? "");
  const group_id = String(formData.get("group_id") ?? "");
  const relationship = String(formData.get("relationship") ?? "").trim() || null;
  if (!organization_id || !member_id || !group_id) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent("Pick a group."));
  }
  const { error } = await supabase
    .from("member_group_links")
    .insert({ organization_id, member_id, group_id, relationship });
  if (error) {
    // unique (group_id, member_id) — 0003.
    const msg = isUniqueViolation(error)
      ? "This member is already in that group."
      : error.message;
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent(msg));
  }
  revalidatePath(`/dashboard/members/${member_id}`);
  redirect(`/dashboard/members/${member_id}`);
}

export async function removeMemberFromGroup(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const member_id = String(formData.get("member_id") ?? "");
  if (!id) redirect(`/dashboard/members/${member_id}`);
  const { error } = await supabase.from("member_group_links").delete().eq("id", id);
  if (error) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/dashboard/members/${member_id}`);
  redirect(`/dashboard/members/${member_id}`);
}

export async function checkOutMember(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const member_id = String(formData.get("member_id") ?? "");
  if (!id) redirect(`/dashboard/members/${member_id}`);
  const { error } = await supabase
    .from("checkins")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("id", id)
    .is("checked_out_at", null);
  if (error) {
    redirect(`/dashboard/members/${member_id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/dashboard/members/${member_id}`);
  redirect(`/dashboard/members/${member_id}`);
}

export async function updateMemberStatus(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !(MEMBER_STATUSES as readonly string[]).includes(status)) {
    redirect("/dashboard/members");
  }

  const { error } = await supabase
    .from("members")
    .update({ status })
    .eq("id", id);
  if (error) {
    redirect(
      `/dashboard/members/${id}?error=` + encodeURIComponent(error.message),
    );
  }

  revalidatePath(`/dashboard/members/${id}`);
  redirect(`/dashboard/members/${id}`);
}
