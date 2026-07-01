"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function recordSale(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const product_id = String(formData.get("product_id") ?? "");
  const qtyRaw = String(formData.get("quantity") ?? "1").trim();
  const quantity = qtyRaw && !Number.isNaN(Number(qtyRaw)) ? Math.max(1, Math.round(Number(qtyRaw))) : 1;
  if (!product_id) {
    redirect("/dashboard/pos?error=" + encodeURIComponent("Pick a product."));
  }

  // record_sale() (migration 0011) authorizes staff, decrements stock, creates a
  // paid invoice, and emits a sale.recorded event — atomically.
  const { error } = await supabase.rpc("record_sale", {
    p_product_id: product_id,
    p_quantity: quantity,
  });
  if (error) {
    redirect("/dashboard/pos?error=" + encodeURIComponent(error.message));
  }
  revalidatePath("/dashboard/pos");
  redirect("/dashboard/pos?ok=1");
}
