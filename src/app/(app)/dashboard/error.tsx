"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-sm text-ash">{error.message || "Unexpected error."}</p>
      <button
        onClick={reset}
        className="rounded-md border border-iron px-4 py-2 text-sm font-medium hover:border-gold hover:text-gold"
      >
        Try again
      </button>
    </main>
  );
}
