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
