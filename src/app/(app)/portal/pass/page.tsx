import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { WakeLock } from "@/components/WakeLock";

export const dynamic = "force-dynamic";

type MyMember = { id: string; first_name: string; last_name: string; qr_token: string | null; member_number: string | null };

// Dedicated full-screen Arena Pass — the destination of the tab-bar's center FAB.
// Big, high-contrast QR + member number so it scans reliably at the front desk
// (AMD-006 L2/L3/L4: the prominent "Arena Pass" control now leads to a real pass,
// not a duplicate of Home).
export default async function ArenaPassPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase
    .from("members")
    .select("id, first_name, last_name, qr_token, member_number")
    .eq("profile_id", user.id);
  const members = (memberData ?? []) as unknown as MyMember[];
  const me = members[0] ?? null;
  if (!me) redirect("/portal"); // no membership → the claim flow lives on Home
  const memberIds = members.map((m) => m.id);

  const [{ data: subData }, { data: openData }] = await Promise.all([
    supabase.from("subscriptions").select("status, plan:plans(name)").in("member_id", memberIds).eq("status", "active").limit(1),
    supabase.from("checkins").select("id").in("member_id", memberIds).is("checked_out_at", null).limit(1),
  ]);
  const planName = ((subData ?? []) as unknown as { plan: { name: string } | null }[])[0]?.plan?.name ?? null;
  const checkedIn = ((openData ?? []) as { id: string }[]).length > 0;

  // Larger render than Home's 200px hero — this screen exists to be scanned.
  const qrDataUrl = me.qr_token
    ? await QRCode.toDataURL(me.qr_token, { margin: 1, width: 560, color: { dark: "#0A0A0A", light: "#FFFFFF" } })
    : null;

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-1 flex-col items-center gap-6 px-5 pb-28 pt-8">
      <WakeLock />

      <div className="flex w-full items-center justify-between">
        <Link href="/portal" className="text-xs text-ash hover:text-gold">← Home</Link>
        {checkedIn ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-win"><span className="h-[7px] w-[7px] rounded-full bg-win animate-[livepulse_2s_infinite]" />Checked in</span>
        ) : (
          <span className="text-xs text-ash">Show at the front desk</span>
        )}
      </div>

      <div className="text-center">
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-gold">◈ Arena Pass</div>
        <h1 className="mt-1 text-2xl font-extrabold text-bone">{me.first_name} {me.last_name}</h1>
      </div>

      {/* The scan target — as large + bright as the viewport allows. */}
      <div className="rounded-3xl bg-white p-5 shadow-[0_0_40px_rgba(245,197,24,0.25)]">
        {qrDataUrl ? (
          <Image src={qrDataUrl} alt="Your Arena Pass QR code" width={320} height={320} unoptimized className="h-[min(78vw,320px)] w-[min(78vw,320px)]" />
        ) : (
          <div className="grid h-[min(78vw,320px)] w-[min(78vw,320px)] place-items-center text-center text-sm text-black">No pass yet — ask the front desk to link your account.</div>
        )}
      </div>

      <div className="text-center">
        {me.member_number ? (
          <div className="mono text-lg font-bold tracking-[0.08em] text-bone">{me.member_number}</div>
        ) : null}
        <div className="mono mt-0.5 text-xs text-ash">{planName ? planName : "Member"}</div>
      </div>

      <p className="mt-auto text-center text-[11px] text-ash-dim">Hold your phone up to the scanner. Your screen stays awake while this pass is open.</p>
    </main>
  );
}
