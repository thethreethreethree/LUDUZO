import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateMyStaffProfile } from "./actions";

export const dynamic = "force-dynamic";

// §6: staff self-service bio + specialties (shown to members in "Meet the team").
export default async function StaffProfilePage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Separate graceful read — a missing column (pre-0057) leaves the form empty.
  const { data } = await supabase.from("organization_members").select("bio, specialties").eq("user_id", user.id).limit(1);
  const me = ((data ?? []) as { bio: string | null; specialties: string | null }[])[0] ?? null;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">← Dashboard</Link>
        <h1 className="mt-1 text-h1 text-bone">Your profile</h1>
        <p className="mt-1 text-sm text-ash">Your bio and specialties appear to members in “Meet the team”.</p>
      </div>

      {ok ? <p className="rounded-md border border-win/40 bg-win/10 px-3 py-2 text-sm text-win">Profile saved.</p> : null}
      {error ? <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p> : null}

      <form action={updateMyStaffProfile} className="flex flex-col gap-3 rounded-md border border-onyx bg-onyx p-5">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Specialties</span>
          <input name="specialties" defaultValue={me?.specialties ?? ""} placeholder="e.g. Strength · Mobility · Nutrition" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Bio</span>
          <textarea name="bio" rows={4} defaultValue={me?.bio ?? ""} placeholder="Tell members a bit about yourself and how you coach." className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
        </label>
        <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">Save profile</button>
      </form>
    </main>
  );
}
