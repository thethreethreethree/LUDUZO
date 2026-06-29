// Supabase env access with runtime validation.
//
// Deliberately validated at CALL time, not import time: importing this module
// during `next build` (static prerender) must not throw, or a build without a
// populated .env would fail. The factory functions in src/lib/supabase/* call
// this only at runtime (request handlers, the browser submit path, middleware),
// where the env is genuinely required.
export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment. Copy .env.example to .env and set " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return { url, anonKey };
}
