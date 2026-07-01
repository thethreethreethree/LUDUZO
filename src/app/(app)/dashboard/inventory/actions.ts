"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUniqueViolation } from "@/lib/pg-errors";

export async function createProduct(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const priceRaw = String(formData.get("price") ?? "").trim();
  const price_cents = priceRaw && !Number.isNaN(Number(priceRaw)) ? Math.round(Number(priceRaw) * 100) : 0;
  const stockRaw = String(formData.get("stock") ?? "").trim();
  const stock_quantity = stockRaw && !Number.isNaN(Number(stockRaw)) ? Math.round(Number(stockRaw)) : 0;
  const reorderRaw = String(formData.get("reorder_level") ?? "").trim();
  const reorder_level = reorderRaw && !Number.isNaN(Number(reorderRaw)) ? Math.round(Number(reorderRaw)) : 0;

  if (!organization_id || !name) {
    redirect("/dashboard/inventory?error=" + encodeURIComponent("Gym and name are required."));
  }
  const { error } = await supabase
    .from("products")
    .insert({ organization_id, name, sku, price_cents, stock_quantity, reorder_level });
  if (error) {
    // uq_products_org_sku — unique (organization_id, sku) (0008).
    const msg = isUniqueViolation(error) ? "A product with that SKU already exists." : error.message;
    redirect("/dashboard/inventory?error=" + encodeURIComponent(msg));
  }
  revalidatePath("/dashboard/inventory");
  redirect("/dashboard/inventory");
}

export async function adjustStock(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const qtyRaw = String(formData.get("stock_quantity") ?? "").trim();
  if (!id || qtyRaw === "" || Number.isNaN(Number(qtyRaw))) redirect("/dashboard/inventory");
  const stock_quantity = Math.max(0, Math.round(Number(qtyRaw)));
  const { error } = await supabase.from("products").update({ stock_quantity }).eq("id", id);
  if (error) redirect("/dashboard/inventory?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/inventory");
  redirect("/dashboard/inventory");
}

export async function toggleProductActive(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) redirect("/dashboard/inventory");
  const { error } = await supabase.from("products").update({ active: !active }).eq("id", id);
  if (error) redirect("/dashboard/inventory?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/inventory");
  redirect("/dashboard/inventory");
}

export async function updateEquipmentStatus(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) redirect("/dashboard/inventory");
  const { error } = await supabase.from("equipment").update({ status }).eq("id", id);
  if (error) redirect("/dashboard/inventory?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/inventory");
  redirect("/dashboard/inventory");
}

export async function createEquipment(formData: FormData) {
  const supabase = await createClient();
  const organization_id = String(formData.get("organization_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const status = String(formData.get("status") ?? "operational");
  const purchased_at = String(formData.get("purchased_at") ?? "").trim() || null;
  if (!organization_id || !name) {
    redirect("/dashboard/inventory?error=" + encodeURIComponent("Gym and name are required."));
  }
  const { error } = await supabase
    .from("equipment")
    .insert({ organization_id, name, status, purchased_at });
  if (error) redirect("/dashboard/inventory?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/inventory");
  redirect("/dashboard/inventory");
}
