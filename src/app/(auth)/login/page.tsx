import Image from "next/image";
import Link from "next/link";
import { login, signup } from "./actions";
import { OAuthButtons } from "@/components/OAuthButtons";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="relative flex flex-1 items-center justify-center p-8">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2">
          {/* White helmet reads on the dark canvas; dark helmet reads on the light one. */}
          <Image src="/brand/luduzo_helmet_white.svg" alt="LUDUZO" width={28} height={28} className="hidden dark:block" />
          <Image src="/brand/luduzo_helmet.svg" alt="LUDUZO" width={28} height={28} className="block dark:hidden" />
          <span className="font-display font-extrabold tracking-widest">LUDUZO</span>
        </Link>
        <h1 className="mt-6 text-h1 text-bone">Sign in</h1>

        {error ? (
          <p className="mt-4 rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 rounded-md bg-onyx-2 px-3 py-2 text-sm text-zinc-700 bg-onyx-2 dark:text-zinc-300">
            {message}
          </p>
        ) : null}

        <div className="mt-6 rounded-md border border-onyx bg-onyx p-5">
          {/* Gated: only shown once the founder enables Google/Apple providers in
              Supabase AND sets NEXT_PUBLIC_OAUTH_ENABLED=true — otherwise the buttons
              would error for real users (§1.5.1 L2). */}
          {process.env.NEXT_PUBLIC_OAUTH_ENABLED === "true" ? (
            <>
              <OAuthButtons />
              <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.07em] text-ash-dim">
                <span className="h-px flex-1 bg-iron" />or<span className="h-px flex-1 bg-iron" />
              </div>
            </>
          ) : null}
          <form className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2"
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
              className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2"
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
              className="flex-1 rounded-md border border-iron px-4 py-2.5 text-sm font-medium hover:bg-onyx-2 hover:bg-onyx-2"
            >
              Create account
            </button>
          </div>
          </form>
        </div>
      </div>
    </main>
  );
}
