"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signMyDocument(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/portal");
  // sign_my_document() (migration 0020) verifies ownership and flips to 'signed'.
  const { error } = await supabase.rpc("sign_my_document", { p_doc_id: id });
  if (error) redirect("/portal?error=" + encodeURIComponent(error.message));
  revalidatePath("/portal");
  redirect("/portal");
}

export async function portalSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

// Member self-service feedback (NPS). Uses the already-live member-insert RLS on
// nps_responses (migration 0031, org-bound) — works without 0034.
export async function submitFeedback(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase.from("members").select("id, organization_id").eq("profile_id", user.id).limit(1);
  const me = ((memberData ?? []) as { id: string; organization_id: string }[])[0];
  if (!me) redirect("/portal/help?error=" + encodeURIComponent("No membership on file."));

  const score = Number(formData.get("score") ?? -1);
  const comment = String(formData.get("comment") ?? "").trim() || null;
  if (!(score >= 0 && score <= 10)) redirect("/portal/help?error=" + encodeURIComponent("Pick a score 0–10."));

  const { error } = await supabase
    .from("nps_responses")
    .insert({ organization_id: me.organization_id, member_id: me.id, score, comment });
  if (error) redirect("/portal/help?error=" + encodeURIComponent(error.message));
  revalidatePath("/portal/help");
  redirect("/portal/help?ok=1");
}

// Member comment on a community post. Uses live community_comments_member_insert RLS
// (0031, org-bound) — works without 0034.
export async function addMemberComment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase.from("members").select("id, organization_id").eq("profile_id", user.id).limit(1);
  const me = ((memberData ?? []) as { id: string; organization_id: string }[])[0];
  if (!me) redirect("/portal/more");

  const post_id = String(formData.get("post_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!post_id || !body) redirect("/portal/more");

  const { error } = await supabase
    .from("community_comments")
    .insert({ organization_id: me.organization_id, post_id, author_member_id: me.id, body });
  if (error) redirect("/portal/more?error=" + encodeURIComponent(error.message));
  revalidatePath("/portal/more");
  redirect("/portal/more");
}

// Member self-books a class session via the book_my_session RPC (0038). The RPC
// is authoritative: it locks the session, counts capacity to decide booked-vs-
// waitlisted, and REVIVES a prior cancelled row (the re-book path a member can't
// take through RLS, since F2 restricts member updates to result-status
// 'cancelled'). Returns the resulting status. §1.5.1 L1 — the decision lives in
// the DB, atomically, not in brittle client retry logic.
export async function bookSession(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const session_id = String(formData.get("session_id") ?? "");
  if (!session_id) redirect("/portal/book");

  const { data, error } = await supabase.rpc("book_my_session", { p_session_id: session_id });
  if (error) {
    // Map raw RPC exceptions (which leak the function name) to member-friendly copy (F-F).
    const m = error.message ?? "";
    const friendly = /no membership/i.test(m) ? "We couldn't find your membership at this gym."
      : /not found/i.test(m) ? "That class isn't available anymore."
      : "Sorry — that booking didn't go through. Please try again.";
    redirect("/portal/book?error=" + encodeURIComponent(friendly));
  }
  revalidatePath("/portal/book"); revalidatePath("/portal");
  redirect("/portal/book?ok=" + (data === "waitlisted" ? "waitlisted" : "booked"));
}

// Member cancels their own booking. RLS bookings_member_cancel (0034) enforces
// own-row + with_check status='cancelled', so this can only ever cancel.
export async function cancelBooking(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/portal/book");

  const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
  if (error) redirect("/portal/book?error=" + encodeURIComponent(error.message));
  revalidatePath("/portal/book"); revalidatePath("/portal");
  redirect("/portal/book?ok=cancelled");
}

// Member logs their own body measurement (0034 member_measurements_member_insert,
// org-bound). At least one metric is required — an all-empty log is meaningless.
export async function logMeasurement(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase.from("members").select("id, organization_id").eq("profile_id", user.id).limit(1);
  const me = ((memberData ?? []) as { id: string; organization_id: string }[])[0];
  if (!me) redirect("/portal/progress?error=" + encodeURIComponent("No membership on file."));

  // Parse + range-check. Columns are numeric(6,2)/(5,2), so out-of-range values
  // would otherwise surface as a raw Postgres overflow error (F-E). A sentinel
  // (NaN) marks "provided but invalid" so we can reject rather than silently drop.
  const num = (k: string, max: number) => {
    const v = String(formData.get(k) ?? "").trim();
    if (!v) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || n > max) return NaN;
    return n;
  };
  const weight_kg = num("weight_kg", 999), body_fat_pct = num("body_fat_pct", 100), muscle_mass_kg = num("muscle_mass_kg", 999);
  if ([weight_kg, body_fat_pct, muscle_mass_kg].some((v) => Number.isNaN(v))) {
    redirect("/portal/progress?error=" + encodeURIComponent("Check your numbers — weight/muscle up to 999 kg, body fat 0–100%."));
  }
  if (weight_kg == null && body_fat_pct == null && muscle_mass_kg == null) {
    redirect("/portal/progress?error=" + encodeURIComponent("Enter at least one measurement."));
  }

  const { error } = await supabase.from("member_measurements").insert({
    organization_id: me.organization_id, member_id: me.id, weight_kg, body_fat_pct, muscle_mass_kg,
  });
  if (error) redirect("/portal/progress?error=" + encodeURIComponent(error.message));
  revalidatePath("/portal/progress");
  redirect("/portal/progress?ok=logged");
}

// Member joins a challenge (0034 challenge_participants_member_insert, org-bound).
// Already-joined (unique challenge_id+member_id → 23505) is treated as success.
export async function joinChallenge(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase.from("members").select("id, organization_id").eq("profile_id", user.id).limit(1);
  const me = ((memberData ?? []) as { id: string; organization_id: string }[])[0];
  if (!me) redirect("/portal/progress?error=" + encodeURIComponent("No membership on file."));

  const challenge_id = String(formData.get("challenge_id") ?? "");
  if (!challenge_id) redirect("/portal/progress");

  const { error } = await supabase.from("challenge_participants").insert({
    organization_id: me.organization_id, challenge_id, member_id: me.id,
  });
  if (error && error.code !== "23505") redirect("/portal/progress?error=" + encodeURIComponent(error.message));
  revalidatePath("/portal/progress");
  redirect("/portal/progress?ok=joined");
}

// Member updates their OWN phone number via the column-restricted RPC (0037).
// Only the phone is writable — name/email/DOB are intentionally not editable here
// (flagged founder decision).
export async function updateMyContact(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const phone = String(formData.get("phone") ?? "").trim();
  const { error } = await supabase.rpc("update_my_contact", { p_phone: phone });
  if (error) {
    const friendly = /too long/i.test(error.message ?? "") ? "That phone number is too long." : "Couldn't save your number. Please try again.";
    redirect("/portal/more?error=" + encodeURIComponent(friendly));
  }
  revalidatePath("/portal/more");
  redirect("/portal/more?ok=contact");
}

// Member marks all their unread notifications as read (0043 update-own RLS).
export async function markNotificationsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase.from("members").select("id").eq("profile_id", user.id);
  const ids = ((memberData ?? []) as { id: string }[]).map((m) => m.id);
  if (ids.length === 0) redirect("/portal/more");

  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("member_id", ids).is("read_at", null);
  revalidatePath("/portal/more");
  redirect("/portal/more");
}

export async function claimRecords() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // link_my_member_records() (migration 0015) links member rows whose email
  // matches the caller's auth email.
  const { error } = await supabase.rpc("link_my_member_records");
  if (error) {
    redirect("/portal?error=" + encodeURIComponent(error.message));
  }
  revalidatePath("/portal");
  redirect("/portal");
}
