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
