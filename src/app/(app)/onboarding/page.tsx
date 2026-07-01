import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createGym } from "./actions";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex items-center gap-2">
          <Image src="/brand/luduzo_helmet_white.svg" alt="LUDUZO" width={24} height={24} />
          <span className="font-display font-extrabold tracking-widest">LUDUZO</span>
        </div>
        <h1 className="text-h1 text-bone">Create your gym</h1>
        <p className="mt-1 text-sm text-ash">
          You&apos;ll be set up as the owner. You can add locations and staff
          afterwards.
        </p>

        {error ? (
          <p className="mt-4 rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
            {error}
          </p>
        ) : null}

        <form action={createGym} className="mt-6 flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-5">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Gym name</span>
            <input
              type="text"
              name="name"
              required
              placeholder="Iron Works Gym"
              className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">URL slug (optional)</span>
            <input
              type="text"
              name="slug"
              placeholder="iron-works"
              className="w-full rounded-md border border-iron px-3 py-2 bg-onyx-2"
            />
            <span className="text-xs text-ash">
              Leave blank to derive it from the name.
            </span>
          </label>
          <button className="mt-2 rounded-md bg-gold px-4 py-2.5 text-sm font-medium text-black hover:opacity-90">
            Create gym
          </button>
        </form>
      </div>
    </main>
  );
}
