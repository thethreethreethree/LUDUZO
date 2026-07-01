import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { kioskCheckIn } from "./actions";

export const dynamic = "force-dynamic";

export default async function KioskPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { count } = await supabase
    .from("checkins")
    .select("id", { count: "exact", head: true })
    .is("checked_out_at", null);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
      <Link href="/dashboard" className="self-start text-sm text-ash hover:underline">
        ← Dashboard
      </Link>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Check in</h1>
        <p className="mt-1 text-sm text-ash">Scan your member QR or enter your token.</p>
      </div>

      {ok ? (
        <p className="w-full rounded-md bg-green-50 px-3 py-3 text-lg font-medium text-win dark:bg-green-950 dark:text-green-300">
          ✓ Checked in. Welcome!
        </p>
      ) : null}
      {error ? (
        <p className="w-full rounded-md bg-red-50 px-3 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <form action={kioskCheckIn} className="flex w-full flex-col gap-3">
        <input
          name="qr_token"
          autoFocus
          placeholder="QR token"
          className="w-full rounded-md border border-iron px-4 py-4 text-center text-lg bg-onyx-2"
        />
        <button className="w-full rounded-md bg-gold px-4 py-4 text-lg font-medium text-black hover:opacity-90">
          Check in
        </button>
      </form>

      <p className="text-sm text-ash">{count ?? 0} currently in the gym</p>
    </main>
  );
}
