"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUniqueViolation } from "@/lib/pg-errors";

export async function updateClass(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const instructor_name = String(formData.get("instructor_name") ?? "").trim() || null;
  const capRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capRaw && !Number.isNaN(Number(capRaw)) ? Number(capRaw) : null;
  if (!id || !name) {
    redirect("/dashboard/classes?error=" + encodeURIComponent("Name is required."));
  }
  const { error } = await supabase
    .from("classes")
    .update({ name, instructor_name, capacity })
    .eq("id", id);
  if (error) redirect("/dashboard/classes?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/classes");
  redirect("/dashboard/classes");
}

export async function createClass(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const instructor_name = String(formData.get("instructor_name") ?? "").trim() || null;
  const capRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capRaw && !Number.isNaN(Number(capRaw)) ? Number(capRaw) : null;

  if (!organization_id || !name) {
    redirect("/dashboard/classes?error=" + encodeURIComponent("Gym and name are required."));
  }
  const { error } = await supabase
    .from("classes")
    .insert({ organization_id, name, instructor_name, capacity });
  if (error) redirect("/dashboard/classes?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/classes");
  redirect("/dashboard/classes");
}

export async function createSession(formData: FormData) {
  const supabase = await createClient();
  const organization_id = String(formData.get("organization_id") ?? "");
  const class_id = String(formData.get("class_id") ?? "");
  const starts_at = String(formData.get("starts_at") ?? "").trim();
  if (!organization_id || !class_id || !starts_at) {
    redirect("/dashboard/classes?error=" + encodeURIComponent("Class and start time are required."));
  }
  const { error } = await supabase
    .from("class_sessions")
    .insert({ organization_id, class_id, starts_at });
  if (error) redirect("/dashboard/classes?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/classes");
  redirect("/dashboard/classes");
}

export async function cancelSession(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/dashboard/classes");
  const { error } = await supabase
    .from("class_sessions")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) {
    redirect(`/dashboard/classes/${id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/dashboard/classes/${id}`);
  redirect(`/dashboard/classes/${id}`);
}

export async function updateBookingStatus(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const session_id = String(formData.get("session_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !session_id) redirect("/dashboard/classes");

  // status change emits booking.status_changed (migration 0007 trigger).
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
  if (error) {
    redirect(`/dashboard/classes/${session_id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/dashboard/classes/${session_id}`);
  redirect(`/dashboard/classes/${session_id}`);
}

export async function createRecurringSessions(formData: FormData) {
  const supabase = await createClient();
  const organization_id = String(formData.get("organization_id") ?? "");
  const class_id = String(formData.get("class_id") ?? "");
  const starts_at = String(formData.get("starts_at") ?? "").trim();
  const countRaw = String(formData.get("count") ?? "").trim();
  const count = Math.min(52, Math.max(1, Number(countRaw) || 1));

  if (!organization_id || !class_id || !starts_at) {
    redirect("/dashboard/classes?error=" + encodeURIComponent("Class and start time are required."));
  }
  const base = new Date(starts_at);
  if (Number.isNaN(base.getTime())) {
    redirect("/dashboard/classes?error=" + encodeURIComponent("Invalid start time."));
  }
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const rows = Array.from({ length: count }, (_, i) => ({
    organization_id,
    class_id,
    starts_at: new Date(base.getTime() + i * WEEK_MS).toISOString(),
  }));

  const { error } = await supabase.from("class_sessions").insert(rows);
  if (error) redirect("/dashboard/classes?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/classes");
  redirect("/dashboard/classes");
}

export async function createBooking(formData: FormData) {
  const supabase = await createClient();
  const organization_id = String(formData.get("organization_id") ?? "");
  const session_id = String(formData.get("session_id") ?? "");
  const member_id = String(formData.get("member_id") ?? "");
  if (!organization_id || !session_id || !member_id) {
    redirect("/dashboard/classes?error=" + encodeURIComponent("Pick a member to book."));
  }

  // Don't allow booking a cancelled session.
  const { data: sess } = await supabase
    .from("class_sessions")
    .select("status")
    .eq("id", session_id)
    .maybeSingle();
  if ((sess as { status: string } | null)?.status === "cancelled") {
    redirect("/dashboard/classes?error=" + encodeURIComponent("That session is cancelled."));
  }

  // Route through book_member_into_session (0039) for parity with member self-book
  // (0038): the RPC decides booked-vs-waitlisted by capacity, REVIVES a member's
  // cancelled row (a plain insert hit unique(session_id, member_id) → 23505 and
  // falsely reported "already booked"), and authorizes the caller as staff of the
  // session's org. A21 / §1.5.1 L3 — same concept, same behavior across modules.
  const { data: status, error } = await supabase.rpc("book_member_into_session", {
    p_session_id: session_id,
    p_member_id: member_id,
  });
  if (error) {
    const msg = isUniqueViolation(error) ? "That member is already booked in this session." : error.message;
    redirect("/dashboard/classes?error=" + encodeURIComponent(msg));
  }
  revalidatePath("/dashboard/classes");
  redirect("/dashboard/classes?ok=" + (status === "waitlisted" ? "waitlisted" : "booked"));
}
