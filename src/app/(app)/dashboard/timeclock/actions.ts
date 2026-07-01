"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function clockIn(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  if (!organization_id) redirect("/dashboard/timeclock?error=" + encodeURIComponent("Pick a gym."));

  // RLS (time_entries own-write) requires staff_user_id = auth.uid().
  const { error } = await supabase
    .from("time_entries")
    .insert({ organization_id, staff_user_id: user.id });
  if (error) redirect("/dashboard/timeclock?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/timeclock");
  redirect("/dashboard/timeclock");
}

export async function clockOut(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/dashboard/timeclock");

  const { error } = await supabase
    .from("time_entries")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", id)
    .eq("staff_user_id", user.id)
    .is("clock_out", null);
  if (error) redirect("/dashboard/timeclock?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/timeclock");
  redirect("/dashboard/timeclock");
}
