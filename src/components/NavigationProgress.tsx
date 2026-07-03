"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Top-of-viewport navigation progress bar. Zero runtime deps (react + next/navigation).
// Gives instant motion feedback the moment a link is tapped — before the server does
// any work — so a slow network still feels responsive.
//
// SMOOTHNESS: the fill is animated with `transform: scaleX()`, not `width`. Width
// animation runs on the main thread and stutters precisely while Next renders the new
// route; a transform is composited on the GPU, so the sweep stays buttery even mid-
// navigation. The motion is one CONTINUOUS ease-out (fast off the mark, decelerating
// to a crawl, never quite reaching 90%) rather than stepped intervals. On commit it
// fills to 100% quickly, holds a beat, then fades. A minimum-visible window keeps
// instant (prefetched) navigations from blinking.

const CREEP_MS = 14000; // slow asymptotic creep toward 90% (never reached in practice)
const FILL_MS = 280;    // quick, confident fill to 100% on commit
const FADE_MS = 320;    // fade-out after the fill
const MIN_VISIBLE = 550; // guarantee the sweep is perceptible even on instant commits

type Phase = "creep" | "fill" | "fade";

export function NavigationProgress() {
  const [active, setActive] = useState(false);
  const [scale, setScale] = useState(0); // 0..1 → scaleX of a full-width bar
  const [phase, setPhase] = useState<Phase>("creep");

  const activeRef = useRef(false);
  const startedAtRef = useRef(0);
  const bumpRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    for (const r of [bumpRef, safetyRef, doneRef]) {
      if (r.current) { clearTimeout(r.current); r.current = null; }
    }
  }, []);

  // Fill to 100%, hold a beat so the full bar registers, then fade and unmount.
  const complete = useCallback(() => {
    setPhase("fill");
    setScale(1);
    doneRef.current = setTimeout(() => {
      setPhase("fade");
      doneRef.current = setTimeout(() => {
        activeRef.current = false;
        setActive(false);
        setScale(0);
        setPhase("creep");
        doneRef.current = null;
      }, FADE_MS);
    }, FILL_MS);
  }, []);

  // Called on route commit. Hold until the sweep has had its minimum visible time so
  // instant navigations still read as motion instead of a flash.
  const finish = useCallback(() => {
    if (!activeRef.current) return;
    if (bumpRef.current) { clearTimeout(bumpRef.current); bumpRef.current = null; }
    if (safetyRef.current) { clearTimeout(safetyRef.current); safetyRef.current = null; }
    const elapsed = Date.now() - startedAtRef.current;
    if (elapsed < MIN_VISIBLE) {
      doneRef.current = setTimeout(complete, MIN_VISIBLE - elapsed);
    } else {
      complete();
    }
  }, [complete]);

  // Begin a run. No-op if one is already in flight (rapid re-clicks keep the running
  // bar rather than restarting the sweep).
  const start = useCallback(() => {
    if (activeRef.current) return;
    clearTimers();
    activeRef.current = true;
    startedAtRef.current = Date.now();
    setPhase("creep");
    setActive(true);
    setScale(0.06); // appear
    // Next paint: kick off the smooth GPU-composited creep toward 90%.
    bumpRef.current = setTimeout(() => setScale(0.9), 40);
    // Safety valve: if the navigation truly hangs, close the bar rather than stick.
    safetyRef.current = setTimeout(() => finish(), 10000);
  }, [clearTimers, finish]);

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
    // Depend only on the commit signals; finish is stable (useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Clean up any pending timers on unmount.
  useEffect(() => () => clearTimers(), [clearTimers]);

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
        opacity: phase === "fade" ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
      }}
    >
      <div
        style={{
          height: "100%",
          width: "100%",
          transformOrigin: "left center",
          transform: `scaleX(${scale})`,
          willChange: "transform",
          background: "linear-gradient(90deg, #C9950F 0%, #F5C518 45%, #FFE083 100%)",
          boxShadow: "0 0 14px 2px rgba(245, 197, 24, 0.85), 0 1px 0 rgba(255, 255, 255, 0.35) inset",
          transition:
            phase === "creep"
              ? `transform ${CREEP_MS}ms cubic-bezier(0.05, 0.7, 0.1, 1)`
              : `transform ${FILL_MS}ms ease-out`,
        }}
      />
    </div>
  );
}
