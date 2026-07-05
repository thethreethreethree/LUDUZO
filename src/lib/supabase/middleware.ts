// Session refresh + route protection, run from src/middleware.ts on every request.
// Pattern follows the official @supabase/ssr Next.js guide: do not insert code
// between createServerClient and getUser(), and always return the supabaseResponse
// so refreshed auth cookies propagate to the browser.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Path prefixes that require an authenticated session.
const PROTECTED_PREFIXES = ["/dashboard", "/portal"];
// Public exceptions under a protected prefix: the PWA manifest + generated app icon.
// The OS fetches these during install WITHOUT the session cookie, and they only emit
// the gym's public branding (name/logo/colours) from query params — nothing sensitive.
const PUBLIC_EXCEPTIONS = ["/portal/manifest", "/portal/icon"];

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
  const needsAuth =
    PROTECTED_PREFIXES.some((p) => path.startsWith(p)) &&
    // Exact-match the exceptions (not startsWith) so only these precise routes are
    // public — a future /portal/icon-something route wouldn't be exposed by accident.
    !PUBLIC_EXCEPTIONS.includes(path);
  if (needsAuth && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("message", "Please sign in to continue.");
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
