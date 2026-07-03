"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Top-of-viewport navigation progress bar. Zero runtime deps (react + next/navigation
// only). Gives instant motion feedback the moment a link is tapped — before the server
// does any work — so a slow network still feels responsive.
//
// Trigger model (per spec): intercept document clicks on the CAPTURE phase, walk to the
// nearest <a>, and start only for a real internal same-origin navigation. This covers
// <Link>, router.push()-backed anchors, and <form action> targets that render anchors —
// unlike Next's experimental useLinkStatus, which only sees <Link>. Finish is driven by
// a real route commit (pathname/searchParams change), never by internal router events.
export function NavigationProgress() {
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);

  const activeRef = useRef(false);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Minimum on-screen time. Without this, a prefetched (instant) route commit fires
  // finish() a few ms after start() and the bar flashes invisibly — the "it doesn't
  // appear" case. Added to the original spec deliberately (see build note).
  const MIN_VISIBLE = 400;

  const clearTimers = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (safetyRef.current) { clearTimeout(safetyRef.current); safetyRef.current = null; }
  }, []);

  // The visual close: jump to 100%, fade, then unmount one 220ms window later so the
  // user sees the bar fill and fade. Only this ever reaches 100%.
  const complete = useCallback(() => {
    setProgress(100);
    setFading(true);
    doneRef.current = setTimeout(() => {
      activeRef.current = false;
      setActive(false);
      setProgress(0);
      setFading(false);
      doneRef.current = null;
    }, 220);
  }, []);

  // Called on route commit. Hold the bar until it's had its minimum visible time, so
  // instant navigations still register as motion feedback instead of a blink.
  const finish = useCallback(() => {
    if (!activeRef.current) return;
    clearTimers();
    const elapsed = Date.now() - startedAtRef.current;
    if (elapsed < MIN_VISIBLE) {
      doneRef.current = setTimeout(complete, MIN_VISIBLE - elapsed);
    } else {
      complete();
    }
  }, [clearTimers, complete]);

  // Begin a run. No-op if one is already in flight (rapid re-clicks keep the running
  // bar rather than snapping back). Eases asymptotically toward 85% and holds there.
  const start = useCallback(() => {
    if (activeRef.current) return;
    if (doneRef.current) { clearTimeout(doneRef.current); doneRef.current = null; }
    activeRef.current = true;
    startedAtRef.current = Date.now();
    setFading(false);
    setActive(true);
    setProgress(8);
    tickRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 85) return p;
        const step = (85 - p) * 0.12;
        return p + Math.max(0.6, step);
      });
    }, 180);
    // Safety valve: if the navigation truly hangs, drop the bar rather than stick.
    safetyRef.current = setTimeout(() => finish(), 10000);
  }, [finish]);

  // ---- Start trigger: capture-phase document click on a real internal navigation ----
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented) return;
      const target = e.target as Element | null;
      const anchor = target && "closest" in target ? target.closest("a") : null;
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (anchor.hasAttribute("download")) return;

      const linkTarget = anchor.getAttribute("target");
      if (linkTarget && linkTarget !== "_self") return;

      let url: URL;
      try { url = new URL(anchor.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;

      // Same path AND query → no navigation commits, so don't show a bar.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      start();
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [start]);

  // ---- Finish trigger: a real route commit (pathname or query changed) ----
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (activeRef.current) finish();
    // Depend only on the commit signals per spec; finish is stable (useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Clean up any pending timers on unmount.
  useEffect(() => () => {
    clearTimers();
    if (doneRef.current) { clearTimeout(doneRef.current); doneRef.current = null; }
  }, [clearTimers]);

  if (!active) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 6,
        zIndex: 2147483646,
        pointerEvents: "none",
        opacity: fading ? 0 : 1,
        transition: "opacity 220ms ease-out",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, #C9950F 0%, #F5C518 45%, #FFE083 100%)",
          boxShadow: "0 0 14px 2px rgba(245, 197, 24, 0.85), 0 1px 0 rgba(255, 255, 255, 0.35) inset",
          transition: "width 180ms ease-out",
        }}
      />
    </div>
  );
}
