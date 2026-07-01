"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createPost(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const organization_id = String(formData.get("organization_id") ?? "");
  const title = String(formData.get("title") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();
  if (!organization_id || !body) redirect("/dashboard/community?error=" + encodeURIComponent("Gym and message are required."));
  const { error } = await supabase.from("community_posts").insert({ organization_id, author_id: user.id, title, body });
  if (error) redirect("/dashboard/community?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/community");
  redirect("/dashboard/community");
}

export async function addComment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const organization_id = String(formData.get("organization_id") ?? "");
  const post_id = String(formData.get("post_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!organization_id || !post_id || !body) redirect("/dashboard/community");
  const { error } = await supabase.from("community_comments").insert({ organization_id, post_id, author_id: user.id, body });
  if (error) redirect("/dashboard/community?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/community");
  redirect("/dashboard/community");
}
