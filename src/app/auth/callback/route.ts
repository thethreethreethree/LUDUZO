import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth (and magic-link) callback: exchanges the ?code for a session cookie, then
// routes staff → /dashboard, members → /portal (mirrors the password login action).
// Inert until the founder enables the Google/Apple providers in Supabase.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorDescription)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Sign-in was cancelled or failed.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  const { count } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true });

  return NextResponse.redirect(`${origin}${count && count > 0 ? "/dashboard" : "/portal"}`);
}
