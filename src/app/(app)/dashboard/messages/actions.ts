"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function sendMessage(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const to_user = String(formData.get("to_user") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!organization_id || !to_user || !body) {
    redirect("/dashboard/messages?error=" + encodeURIComponent("Recipient and message are required."));
  }
  const { error } = await supabase
    .from("internal_messages")
    .insert({ organization_id, from_user: user.id, to_user, body });
  if (error) redirect("/dashboard/messages?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/messages");
  redirect("/dashboard/messages");
}

export async function markRead(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/dashboard/messages");
  const { error } = await supabase
    .from("internal_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) redirect("/dashboard/messages?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/messages");
  redirect("/dashboard/messages");
}
