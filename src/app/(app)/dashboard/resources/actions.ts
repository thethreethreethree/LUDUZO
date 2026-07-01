"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createResource(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "other");
  const capRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capRaw && !Number.isNaN(Number(capRaw)) ? Math.max(1, Number(capRaw)) : 1;
  const rateRaw = String(formData.get("hourly_rate") ?? "").trim();
  const hourly_rate_cents = rateRaw ? Math.round(Number(rateRaw) * 100) : 0;

  if (!organization_id || !name) {
    redirect("/dashboard/resources?error=" + encodeURIComponent("Gym and name are required."));
  }
  const { error } = await supabase.from("resources").insert({
    organization_id,
    name,
    type,
    capacity,
    hourly_rate_cents: Number.isFinite(hourly_rate_cents) ? hourly_rate_cents : 0,
  });
  if (error) redirect("/dashboard/resources?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/resources");
  redirect("/dashboard/resources");
}

export async function bookResource(formData: FormData) {
  const supabase = await createClient();
  const organization_id = String(formData.get("organization_id") ?? "");
  const resource_id = String(formData.get("resource_id") ?? "");
  const member_id = String(formData.get("member_id") ?? "") || null;
  const starts_at = String(formData.get("starts_at") ?? "");
  const ends_at = String(formData.get("ends_at") ?? "");
  if (!organization_id || !resource_id || !starts_at || !ends_at) {
    redirect("/dashboard/resources?error=" + encodeURIComponent("Resource, start and end are required."));
  }
  if (new Date(ends_at) <= new Date(starts_at)) {
    redirect("/dashboard/resources?error=" + encodeURIComponent("End must be after start."));
  }
  const { error } = await supabase
    .from("resource_bookings")
    .insert({ organization_id, resource_id, member_id, starts_at, ends_at });
  if (error) {
    // The no-overlap trigger raises exclusion_violation (23P01) on a clash.
    const msg = error.code === "23P01" ? "That resource is already booked for that time." : error.message;
    redirect("/dashboard/resources?error=" + encodeURIComponent(msg));
  }
  revalidatePath("/dashboard/resources");
  redirect("/dashboard/resources");
}

export async function cancelResourceBooking(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/dashboard/resources");
  const { error } = await supabase.from("resource_bookings").update({ status: "cancelled" }).eq("id", id);
  if (error) redirect("/dashboard/resources?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/resources");
  redirect("/dashboard/resources");
}
