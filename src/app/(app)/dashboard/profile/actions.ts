"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Staff self-edit of their own bio + specialties (0057 RPC; updates the caller's
// own organization_members row(s)).
export async function updateMyStaffProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const bio = String(formData.get("bio") ?? "").trim();
  const specialties = String(formData.get("specialties") ?? "").trim();
  const { error } = await supabase.rpc("update_my_staff_profile", { p_bio: bio, p_specialties: specialties });
  if (error) {
    const friendly = error.code === "42883" ? "Staff profiles are being set up — check back shortly."
      : /too long/i.test(error.message ?? "") ? "That's a bit long — shorten it." : "Couldn't save. Please try again.";
    redirect("/dashboard/profile?error=" + encodeURIComponent(friendly));
  }
  revalidatePath("/dashboard/profile");
  redirect("/dashboard/profile?ok=1");
}
