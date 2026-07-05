"use client";

import Link from "next/link";

// Member-facing error boundary for the branded portal (webapp/PWA). Without it, a throw
// in any portal page bubbles to Next's generic unstyled "Application error" — jarring on
// the surface the gym has themed, and it can surface raw internal error text to a member
// (a customer, not staff). So: a friendly message only (never error.message), the theme's
// own classes (overridden per-gym by the portal layout's scoped <style>, so this follows
// the gym's colours), and TWO exits so a persistent error is never a dead-end — retry, and
// a link home. `digest` is a hash, safe to show, and lets support correlate to server logs.
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-bone">Something went wrong</h1>
      <p className="max-w-xs text-sm text-ash">
        We hit a snag loading this page. Please try again — if it keeps happening, come back
        in a moment.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={reset}
          className="rounded-md border border-iron px-4 py-2 text-sm font-medium text-bone hover:border-gold hover:text-gold"
        >
          Try again
        </button>
        <Link
          href="/portal"
          className="rounded-md border border-iron px-4 py-2 text-sm font-medium text-bone hover:border-gold hover:text-gold"
        >
          Back to home
        </Link>
      </div>
      {error.digest ? <p className="text-xs text-ash">Reference: {error.digest}</p> : null}
    </main>
  );
}
