"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Google / Apple sign-in. signInWithOAuth must run client-side (it redirects the
// browser to the provider). Returns to /auth/callback, which exchanges the code.
// INERT until the providers are enabled in the Supabase dashboard — until then the
// provider redirect errors and the callback bounces back to /login with the message.
export function OAuthButtons() {
  const [busy, setBusy] = useState<string | null>(null);

  const signIn = async (provider: "google" | "apple") => {
    setBusy(provider);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        window.location.href = `/login?error=${encodeURIComponent(error.message)}`;
      }
    } catch {
      setBusy(null);
      window.location.href = `/login?error=${encodeURIComponent("Could not start sign-in. Please try again.")}`;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => signIn("google")}
        disabled={busy !== null}
        className="flex items-center justify-center gap-2 rounded-md border border-iron bg-onyx-2 px-4 py-2.5 text-sm font-semibold text-bone hover:border-gold disabled:opacity-60"
      >
        {busy === "google" ? "Redirecting…" : "Continue with Google"}
      </button>
      <button
        type="button"
        onClick={() => signIn("apple")}
        disabled={busy !== null}
        className="flex items-center justify-center gap-2 rounded-md border border-iron bg-onyx-2 px-4 py-2.5 text-sm font-semibold text-bone hover:border-gold disabled:opacity-60"
      >
        {busy === "apple" ? "Redirecting…" : "Continue with Apple"}
      </button>
    </div>
  );
}
