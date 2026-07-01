"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { APPOINTMENT_STATUSES } from "@/lib/scheduling";

export async function createAppointment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const member_id = String(formData.get("member_id") ?? "") || null;
  const trainer_id = String(formData.get("trainer_id") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim() || null;
  const starts_at = String(formData.get("starts_at") ?? "");
  const ends_at = String(formData.get("ends_at") ?? "");
  const priceRaw = String(formData.get("price") ?? "").trim();
  const price_cents = priceRaw ? Math.round(Number(priceRaw) * 100) : 0;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!organization_id || !starts_at || !ends_at) {
    redirect("/dashboard/appointments?error=" + encodeURIComponent("Gym, start and end time are required."));
  }
  if (new Date(ends_at) <= new Date(starts_at)) {
    redirect("/dashboard/appointments?error=" + encodeURIComponent("End time must be after start time."));
  }

  const { error } = await supabase.from("appointments").insert({
    organization_id,
    member_id,
    trainer_id,
    title,
    starts_at,
    ends_at,
    price_cents: Number.isFinite(price_cents) ? price_cents : 0,
    notes,
  });
  if (error) redirect("/dashboard/appointments?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/appointments");
  redirect("/dashboard/appointments");
}

export async function updateAppointmentStatus(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !APPOINTMENT_STATUSES.includes(status as (typeof APPOINTMENT_STATUSES)[number])) {
    redirect("/dashboard/appointments");
  }
  const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
  if (error) redirect("/dashboard/appointments?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/appointments");
  redirect("/dashboard/appointments");
}
