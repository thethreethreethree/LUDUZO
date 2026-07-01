"use client";

// Browser print-to-PDF. Honest "PDF export": uses the browser's native print dialog
// (Save as PDF), which needs no server-side PDF engine.
export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold print:hidden"
    >
      {label}
    </button>
  );
}
