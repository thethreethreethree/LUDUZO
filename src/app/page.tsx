import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">LUDUZO</h1>
        <p className="max-w-md text-zinc-600 dark:text-zinc-400">
          Multi-tenant gym management. Each gym&apos;s data is isolated at the
          database level.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Sign in
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
