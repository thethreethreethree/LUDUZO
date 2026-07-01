import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-zinc-500">That page doesn&apos;t exist.</p>
      <Link href="/" className="text-sm font-medium text-gold hover:underline">
        Go home
      </Link>
    </main>
  );
}
