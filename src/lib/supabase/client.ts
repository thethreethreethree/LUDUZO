// Browser (client component) Supabase client.
// Constructed only inside event handlers at runtime — never at module top level —
// so a static prerender during `next build` does not require env to be present.
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/env";

export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
