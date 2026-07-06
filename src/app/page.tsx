import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          {/* White helmet reads on the dark canvas; dark helmet reads on the light one. */}
          <Image src="/brand/luduzo_helmet_white.svg" alt="LUDUZO" width={32} height={32} priority className="hidden dark:block" />
          <Image src="/brand/luduzo_helmet.svg" alt="LUDUZO" width={32} height={32} priority className="block dark:hidden" />
          <span className="font-display text-lg font-extrabold tracking-widest">LUDUZO</span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <ThemeToggle />
          <Link href="/login" className="text-ash hover:text-bone">
            Sign in
          </Link>
          <Link
            href="/login"
            className="rounded-md bg-gold px-4 py-2 font-display text-sm font-bold text-black hover:opacity-90"
          >
            Start free
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6 py-20 text-center">
        <span className="rounded-full bg-onyx px-4 py-1.5 font-display text-xs font-bold tracking-widest text-gold">
          GYM MANAGEMENT, REFORGED
        </span>
        <h1 className="font-display text-5xl font-extrabold leading-[1.05] sm:text-6xl">
          Run your gym like
          <br />
          an <span className="text-gold">arena</span>
        </h1>
        <p className="max-w-md text-lg text-ash">
          Memberships, classes, billing, and check-ins in one command center built for gyms that
          compete to win.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-md bg-gold px-6 py-3 font-display text-sm font-bold text-black hover:opacity-90"
          >
            Start free trial
          </Link>
          <Link
            href="/portal"
            className="rounded-md border border-iron px-6 py-3 font-display text-sm font-bold hover:bg-onyx"
          >
            Member portal
          </Link>
        </div>
        <div className="flex items-center gap-8 pt-4 text-sm">
          <span>
            <span className="font-bold text-gold">Multi-tenant</span>
            <span className="text-ash"> by design</span>
          </span>
          <span>
            <span className="font-bold text-gold">RLS</span>
            <span className="text-ash"> isolation</span>
          </span>
          <span>
            <span className="font-bold text-gold">Self-serve</span>
            <span className="text-ash"> portal</span>
          </span>
        </div>
      </main>
    </div>
  );
}
