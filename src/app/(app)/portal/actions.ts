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

// Member self-books a class session. Uses the live 0034 member-insert RLS +
// the 0032 capacity trigger as the enforcement point.
//
// WHY this shape: a member cannot read OTHER members' bookings (RLS 0022 scopes
// SELECT to their own rows), so the client can't count how full a session is to
// decide booked-vs-waitlisted. Instead of a new SECURITY DEFINER RPC, we let the
// already-tested capacity trigger (0032) be the arbiter: try 'booked'; if the
// trigger rejects it as full (check_violation / 23514), retry as 'waitlisted'
// (which the trigger exempts). §1.5.1 L1 — the capacity decision stays in the DB.
export async function bookSession(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase.from("members").select("id, organization_id").eq("profile_id", user.id).limit(1);
  const me = ((memberData ?? []) as { id: string; organization_id: string }[])[0];
  if (!me) redirect("/portal/book?error=" + encodeURIComponent("No membership on file."));

  const session_id = String(formData.get("session_id") ?? "");
  if (!session_id) redirect("/portal/book");

  // Confirm the session is in the member's org (they can read it via 0034) — this
  // keeps the booking's organization_id consistent with the session it points at.
  const { data: sessRows } = await supabase.from("class_sessions").select("id, organization_id").eq("id", session_id).limit(1);
  const sess = ((sessRows ?? []) as { id: string; organization_id: string }[])[0];
  if (!sess || sess.organization_id !== me.organization_id) {
    redirect("/portal/book?error=" + encodeURIComponent("That class isn't available."));
  }

  const row = { organization_id: me.organization_id, session_id, member_id: me.id };
  const first = await supabase.from("bookings").insert({ ...row, status: "booked" });
  if (first.error) {
    // 23514 = capacity trigger rejected (session full) → offer the waitlist.
    if (first.error.code === "23514") {
      const wl = await supabase.from("bookings").insert({ ...row, status: "waitlisted" });
      if (wl.error) redirect("/portal/book?error=" + encodeURIComponent(wl.error.message));
      revalidatePath("/portal/book"); revalidatePath("/portal");
      redirect("/portal/book?ok=waitlisted");
    }
    // 23505 = unique(session_id, member_id) → already has a booking for this session.
    if (first.error.code === "23505") redirect("/portal/book?error=" + encodeURIComponent("You're already booked for that class."));
    redirect("/portal/book?error=" + encodeURIComponent(first.error.message));
  }
  revalidatePath("/portal/book"); revalidatePath("/portal");
  redirect("/portal/book?ok=booked");
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
