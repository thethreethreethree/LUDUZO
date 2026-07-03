"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

// A submit button that shows its own pending state while the form's server action
// runs. The top navigation bar only reacts to link clicks; server-action forms
// (Book, Redeem, Cancel, Sign…) had no feedback between tap and result — this fills
// that gap with an inline spinner + disabled state, so a slow action still feels
// responsive. Drop-in for a plain <button type="submit"> inside a <form action=…>.
export function SubmitButton({
  children,
  className,
  pendingLabel,
}: {
  children: ReactNode;
  className?: string;
  /** Optional text to show while pending (defaults to the normal label). */
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className}
      style={pending ? { opacity: 0.8, cursor: "default" } : undefined}
    >
      <span className="inline-flex items-center justify-center gap-1.5">
        {pending ? (
          <span
            aria-hidden
            className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : null}
        {pending ? pendingLabel ?? children : children}
      </span>
    </button>
  );
}
