"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkinErrorMessage } from "@/lib/checkins";

export async function kioskCheckIn(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const qr = String(formData.get("qr_token") ?? "").trim();
  if (!qr) redirect("/dashboard/kiosk?error=" + encodeURIComponent("Scan or enter a QR token."));

  const { data: m } = await supabase.from("members").select("id, organization_id").eq("qr_token", qr).maybeSingle();
  if (!m) redirect("/dashboard/kiosk?error=" + encodeURIComponent("No member for that token."));

  const member = m as { id: string; organization_id: string };

  const { data: openExisting } = await supabase
    .from("checkins")
    .select("id")
    .eq("member_id", member.id)
    .is("checked_out_at", null)
    .limit(1)
    .maybeSingle();
  if (openExisting) {
    redirect("/dashboard/kiosk?error=" + encodeURIComponent("You're already checked in."));
  }

  const { error } = await supabase.from("checkins").insert({
    organization_id: member.organization_id,
    member_id: member.id,
    method: "qr",
  });
  // A race past the app guard trips uq_checkins_open_member (0018); keep the kiosk voice.
  if (error) redirect("/dashboard/kiosk?error=" + encodeURIComponent(checkinErrorMessage(error, "You're already checked in.")));

  revalidatePath("/dashboard/kiosk");
  redirect("/dashboard/kiosk?ok=1");
}
