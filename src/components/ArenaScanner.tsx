"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type MemberOpt = { id: string; first_name: string; last_name: string };

// Front-desk Arena scanner. Replaces the decorative viewfinder with a real camera
// + QR decode (jsQR — reliable on Windows Chrome, unlike native BarcodeDetector).
// On decode it writes the token into the existing form and submits recordCheckin,
// so the verified server-action path is reused. Manual check-in remains the
// fallback for when the camera is unavailable/denied. §1.5.1 L2 (make it actually
// work), A21 (parity with the member Arena Pass QR).
export function ArenaScanner({
  members,
  action,
  btnClass,
}: {
  members: MemberOpt[];
  action: (formData: FormData) => void | Promise<void>;
  btnClass: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const tokenRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const [state, setState] = useState<"idle" | "on" | "denied" | "error" | "found">("idle");

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    submittedRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();
      setState("on");

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const tick = () => {
        if (submittedRef.current) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (code && code.data.trim()) {
            submittedRef.current = true;
            setState("found");
            if (tokenRef.current) tokenRef.current.value = code.data.trim();
            stop();
            formRef.current?.requestSubmit();
            return;
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setState((e as Error)?.name === "NotAllowedError" ? "denied" : "error");
    }
  }, [stop]);

  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  return (
    <>
      {/* Viewfinder */}
      <div className="relative mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-lg border border-iron bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
        <span className="pointer-events-none absolute left-3 top-3 h-6 w-6 rounded-tl border-l-2 border-t-2 border-gold" />
        <span className="pointer-events-none absolute right-3 top-3 h-6 w-6 rounded-tr border-r-2 border-t-2 border-gold" />
        <span className="pointer-events-none absolute bottom-3 left-3 h-6 w-6 rounded-bl border-b-2 border-l-2 border-gold" />
        <span className="pointer-events-none absolute bottom-3 right-3 h-6 w-6 rounded-br border-b-2 border-r-2 border-gold" />
        {state === "on" ? (
          <span className="pointer-events-none absolute left-4 right-4 h-0.5 animate-scanline bg-gold/70" style={{ top: "18%" }} />
        ) : null}
        {state === "found" ? (
          <span className="absolute inset-0 grid place-items-center bg-black/60 text-sm font-semibold text-win">Pass found — checking in…</span>
        ) : null}
        {state === "denied" || state === "error" ? (
          <span className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-ash-dim">
            {state === "denied" ? "Camera blocked. Allow camera access, or check in by name below." : "Camera unavailable. Check in by name below."}
          </span>
        ) : null}
        {state === "idle" ? (
          <span className="absolute inset-0 grid place-items-center text-2xl text-ash-dim">▢</span>
        ) : null}
      </div>

      {state === "denied" || state === "error" ? (
        <button type="button" onClick={start} className="text-center text-xs text-gold hover:underline">
          Retry camera
        </button>
      ) : (
        <p className="text-center text-xs text-ash-dim">Point the camera at the member&apos;s QR — or use manual check-in below.</p>
      )}

      {/* Manual / scan-target form (reused by the decoder) */}
      <form ref={formRef} action={action} className="flex flex-col gap-2">
        <select name="member_id" className="w-full rounded-md border border-iron bg-onyx-2 px-3 py-2 text-sm text-bone">
          <option value="">Select member…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.last_name}, {m.first_name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            ref={tokenRef}
            name="qr_token"
            placeholder="…or type member ID"
            className="mono min-w-0 flex-1 rounded-md border border-iron bg-onyx-2 px-3 py-2 text-sm text-bone placeholder:text-ash-dim"
          />
          <button className={btnClass}>Check in</button>
        </div>
      </form>
    </>
  );
}
