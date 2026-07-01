"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkinErrorMessage } from "@/lib/checkins";

export async function recordCheckin(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let member_id = String(formData.get("member_id") ?? "");
  const qr = String(formData.get("qr_token") ?? "").trim();

  // Resolve by QR token if no member was picked (RLS scopes to the user's gyms).
  if (!member_id && qr) {
    const { data: m } = await supabase
      .from("members")
      .select("id")
      .eq("qr_token", qr)
      .maybeSingle();
    if (m) member_id = (m as { id: string }).id;
  }
  if (!member_id) {
    redirect("/dashboard/checkins?error=" + encodeURIComponent("Pick a member or enter a valid QR token."));
  }

  const { data: mem } = await supabase
    .from("members")
    .select("organization_id")
    .eq("id", member_id)
    .maybeSingle();
  if (!mem) {
    redirect("/dashboard/checkins?error=" + encodeURIComponent("Member not found in your gym."));
  }

  // Guard against a duplicate open check-in (already in the gym).
  const { data: openExisting } = await supabase
    .from("checkins")
    .select("id")
    .eq("member_id", member_id)
    .is("checked_out_at", null)
    .limit(1)
    .maybeSingle();
  if (openExisting) {
    redirect("/dashboard/checkins?error=" + encodeURIComponent("Member is already checked in."));
  }

  const { error } = await supabase.from("checkins").insert({
    organization_id: (mem as { organization_id: string }).organization_id,
    member_id,
    method: qr ? "qr" : "manual",
  });
  if (error) {
    // A race past the app guard trips uq_checkins_open_member (0018) — translate the raw
    // unique-violation into the same friendly message the guard uses.
    redirect("/dashboard/checkins?error=" + encodeURIComponent(checkinErrorMessage(error)));
  }
  revalidatePath("/dashboard/checkins");
  redirect("/dashboard/checkins");
}

export async function checkoutCheckin(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/dashboard/checkins");

  const { error } = await supabase
    .from("checkins")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("id", id)
    .is("checked_out_at", null);
  if (error) {
    redirect("/dashboard/checkins?error=" + encodeURIComponent(error.message));
  }
  revalidatePath("/dashboard/checkins");
  redirect("/dashboard/checkins");
}
