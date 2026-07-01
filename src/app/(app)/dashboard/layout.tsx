import Image from "next/image";
import Link from "next/link";
import { DashboardNav } from "@/components/DashboardNav";
import { signout } from "./actions";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-onyx">
        <nav className="mx-auto flex max-w-6xl items-center gap-5 overflow-x-auto whitespace-nowrap px-6 py-3 text-sm">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
            <Image src="/brand/luduzo_helmet_white.svg" alt="LUDUZO" width={24} height={24} />
            <span className="font-display font-extrabold tracking-widest">LUDUZO</span>
          </Link>
          <DashboardNav />
          <form action={signout} className="ml-auto shrink-0">
            <button className="text-ash hover:text-gold">Sign out</button>
          </form>
        </nav>
      </header>
      {children}
    </div>
  );
}
