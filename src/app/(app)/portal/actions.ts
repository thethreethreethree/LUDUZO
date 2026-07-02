"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const LB_PER_KG = 2.20462;

// §12: member weight-unit preference (kg | lb), stored in a cookie. Display + input
// both use it; the DB always stores kg.
export async function setUnits(formData: FormData) {
  const units = String(formData.get("units") ?? "kg") === "lb" ? "lb" : "kg";
  (await cookies()).set("units", units, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/portal/progress");
  redirect("/portal/progress");
}

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

  // Inputs arrive in the member's unit (kg or lb, hidden field). Parse raw (>0),
  // convert weight/muscle to kg, then range-check the KG value (columns are
  // numeric(6,2)/(5,2) → overflow otherwise, F-E). NaN = provided-but-invalid.
  const units = String(formData.get("units") ?? "kg") === "lb" ? "lb" : "kg";
  const raw = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : NaN;
  };
  const rW = raw("weight_kg"), rMu = raw("muscle_mass_kg"), rBf = raw("body_fat_pct");
  if ([rW, rMu, rBf].some((v) => Number.isNaN(v))) {
    redirect("/portal/progress?error=" + encodeURIComponent("Enter positive numbers only."));
  }
  const toKg = (v: number | null) => (v == null ? null : Math.round((units === "lb" ? v / LB_PER_KG : v) * 100) / 100);
  const weight_kg = toKg(rW as number | null), muscle_mass_kg = toKg(rMu as number | null);
  const body_fat_pct = rBf == null ? null : Math.round((rBf as number) * 100) / 100;
  if ((weight_kg != null && weight_kg > 999) || (muscle_mass_kg != null && muscle_mass_kg > 999) || (body_fat_pct != null && body_fat_pct > 100)) {
    redirect("/portal/progress?error=" + encodeURIComponent("Check your numbers — weight/muscle up to 999 kg (2200 lb), body fat 0–100%."));
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

// Member edits their own name + phone via the column-restricted RPC (0045). Email
// stays front-desk-only (founder decision). Supersedes updateMyContact.
export async function updateMyProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const first = String(formData.get("first_name") ?? "").trim();
  const last = String(formData.get("last_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!first || !last) redirect("/portal/more?error=" + encodeURIComponent("First and last name are required."));

  const { error } = await supabase.rpc("update_my_profile", { p_first_name: first, p_last_name: last, p_phone: phone });
  if (error) {
    const friendly = /too long/i.test(error.message ?? "") ? "One of those values is too long." : "Couldn't save your details. Please try again.";
    redirect("/portal/more?error=" + encodeURIComponent(friendly));
  }
  revalidatePath("/portal/more");
  redirect("/portal/more?ok=profile");
}

// Member logs a self-recorded workout entry (0047). Exercise required; sets/reps/
// weight optional. Weight arrives in the member's unit (kg|lb) → stored as kg.
export async function logWorkout(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase.from("members").select("id, organization_id").eq("profile_id", user.id).limit(1);
  const me = ((memberData ?? []) as { id: string; organization_id: string }[])[0];
  if (!me) redirect("/portal/progress?error=" + encodeURIComponent("No membership on file."));

  const exercise = String(formData.get("exercise") ?? "").trim();
  if (!exercise) redirect("/portal/progress?error=" + encodeURIComponent("Name the exercise."));
  if (exercise.length > 80) redirect("/portal/progress?error=" + encodeURIComponent("Exercise name is too long."));

  const units = String(formData.get("units") ?? "kg") === "lb" ? "lb" : "kg";
  const int = (k: string, max: number) => {
    const v = String(formData.get(k) ?? "").trim();
    if (!v) return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= max ? n : NaN;
  };
  const sets = int("sets", 99), reps = int("reps", 999);
  const wRaw = String(formData.get("weight") ?? "").trim();
  let weight_kg: number | null | typeof NaN = null;
  if (wRaw) {
    const n = Number(wRaw);
    weight_kg = Number.isFinite(n) && n >= 0 ? Math.round((units === "lb" ? n / LB_PER_KG : n) * 100) / 100 : NaN;
  }
  if ([sets, reps, weight_kg].some((v) => typeof v === "number" && Number.isNaN(v)) || (typeof weight_kg === "number" && weight_kg > 999)) {
    redirect("/portal/progress?error=" + encodeURIComponent("Check the numbers — sets ≤99, reps ≤999, weight ≤999 kg."));
  }

  const { error } = await supabase.from("member_workout_logs").insert({
    organization_id: me.organization_id, member_id: me.id, exercise, sets, reps, weight_kg: weight_kg as number | null,
  });
  if (error) {
    // 42P01 = table not created yet (0047 not applied) → friendly, not a raw error.
    const friendly = error.code === "42P01" ? "Workout logging is being set up — check back shortly." : "Couldn't save that workout. Please try again.";
    redirect("/portal/progress?error=" + encodeURIComponent(friendly));
  }
  revalidatePath("/portal/progress");
  redirect("/portal/progress?ok=workout");
}

// Member refers a friend (0049). Creates a referrals row attributed to the member.
export async function submitReferral(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase.from("members").select("id, organization_id").eq("profile_id", user.id).limit(1);
  const me = ((memberData ?? []) as { id: string; organization_id: string }[])[0];
  if (!me) redirect("/portal/more?error=" + encodeURIComponent("No membership on file."));

  const referred_name = String(formData.get("referred_name") ?? "").trim();
  const referred_email = String(formData.get("referred_email") ?? "").trim() || null;
  if (!referred_name) redirect("/portal/more?error=" + encodeURIComponent("Enter your friend's name."));
  if (referred_name.length > 120) redirect("/portal/more?error=" + encodeURIComponent("That name is too long."));

  const { error } = await supabase.from("referrals").insert({
    organization_id: me.organization_id, referrer_member_id: me.id, referred_name, referred_email,
  });
  if (error) {
    // 42501 = RLS denied (0049 not applied yet) → friendly.
    const friendly = error.code === "42501" ? "Referrals are being set up — check back shortly." : "Couldn't send that referral. Please try again.";
    redirect("/portal/more?error=" + encodeURIComponent(friendly));
  }
  revalidatePath("/portal/more");
  redirect("/portal/more?ok=referred");
}

// Member sets their own goals + fitness level (0050 RPC, column-restricted).
export async function updateMyGoals(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const goals = String(formData.get("goals") ?? "").trim();
  const fitness_level = String(formData.get("fitness_level") ?? "").trim();
  const { error } = await supabase.rpc("update_my_goals", { p_goals: goals, p_fitness_level: fitness_level });
  if (error) {
    // 42883 fn missing / 42703 column missing → 0050 not applied yet.
    const friendly = error.code === "42883" || error.code === "42703" ? "Profile goals are being set up — check back shortly."
      : /too long/i.test(error.message ?? "") ? "That's a bit long — shorten it." : "Couldn't save. Please try again.";
    redirect("/portal/more?error=" + encodeURIComponent(friendly));
  }
  revalidatePath("/portal/more");
  redirect("/portal/more?ok=goals");
}

// §12 notification preferences: which in-app notification kinds the member wants to
// see. Stored in a cookie; the /more inbox filters muted kinds out server-side.
const NOTIF_KINDS = ["waitlist_promoted", "document_assigned", "invoice_created"] as const;
export async function setNotifPrefs(formData: FormData) {
  // A checkbox present = "show that kind"; absent = mute it.
  const muted = NOTIF_KINDS.filter((k) => !formData.get("show_" + k));
  (await cookies()).set("notif_mute", muted.join(","), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
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
