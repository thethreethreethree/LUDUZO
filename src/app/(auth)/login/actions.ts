"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // Route staff to the dashboard; customers (no staff role) to the member portal.
  const { count } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true });

  revalidatePath("/", "layout");
  redirect(count && count > 0 ? "/dashboard" : "/portal");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect(
    "/login?message=" +
      encodeURIComponent(
        "Account created. If email confirmation is on, confirm via email, then sign in.",
      ),
  );
}
