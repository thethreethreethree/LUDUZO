"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createGym(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || name);
  if (!name || !slug) {
    redirect("/onboarding?error=" + encodeURIComponent("A gym name is required."));
  }

  // create_organization() is SECURITY DEFINER: it inserts the org, makes the
  // caller the owner, and emits an organization.created event (migration 0002).
  const { error } = await supabase.rpc("create_organization", {
    p_name: name,
    p_slug: slug,
  });
  if (error) {
    redirect("/onboarding?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
