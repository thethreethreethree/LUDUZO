import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/DashboardNav";
import { Avatar, btnGhost } from "@/components/ui";
import { signout } from "./actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const name = user?.email?.split("@")[0] ?? "";

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-iron bg-black/85 backdrop-blur">
        <nav className="mx-auto flex max-w-content items-center gap-6 px-7 py-3">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gold">
              <Image src="/brand/luduzo_helmet.svg" alt="" width={18} height={18} />
            </span>
            <span className="font-display text-[15px] font-extrabold tracking-[0.18em] text-bone">LUDUZO</span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <DashboardNav />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-4">
            <span className="hidden items-center gap-2 rounded-full border border-iron px-3 py-1 text-xs font-semibold text-win sm:inline-flex">
              <span className="h-[7px] w-[7px] rounded-full bg-win animate-[livepulse_2s_infinite]" />
              Arena live
            </span>
            <form action={signout}>
              <button className={`${btnGhost} !px-2`} title="Sign out">Sign out</button>
            </form>
            {name ? <Avatar name={name} size={34} /> : null}
          </div>
        </nav>
      </header>
      {children}
    </div>
  );
}
