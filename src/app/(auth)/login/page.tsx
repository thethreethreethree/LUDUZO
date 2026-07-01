import Image from "next/image";
import Link from "next/link";
import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/brand/luduzo_helmet_white.svg" alt="LUDUZO" width={28} height={28} />
          <span className="font-display font-extrabold tracking-widest">LUDUZO</span>
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sign in</h1>

        {error ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {message}
          </p>
        ) : null}

        <form className="mt-6 flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-5">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Password</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              minLength={6}
              className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          <div className="mt-2 flex gap-3">
            <button
              formAction={login}
              className="flex-1 rounded-md bg-gold px-4 py-2.5 text-sm font-medium text-black hover:opacity-90"
            >
              Sign in
            </button>
            <button
              formAction={signup}
              className="flex-1 rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Create account
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
