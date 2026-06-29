// Session refresh + route protection, run from src/middleware.ts on every request.
// Pattern follows the official @supabase/ssr Next.js guide: do not insert code
// between createServerClient and getUser(), and always return the supabaseResponse
// so refreshed auth cookies propagate to the browser.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Path prefixes that require an authenticated session.
const PROTECTED_PREFIXES = ["/dashboard"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { url, anonKey } = getSupabaseEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const needsAuth = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  if (needsAuth && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("message", "Please sign in to continue.");
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
