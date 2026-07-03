"use client";

import { useEffect } from "react";

// Keeps the screen awake while mounted — used by the Arena Pass so the member's
// phone doesn't dim/sleep while they queue at the front-desk scanner (AMD-006 L2:
// the pass has to actually scan). Feature-detected: a silent no-op where the Wake
// Lock API is absent (older iOS, desktop) — never throws, never blocks render.
export function WakeLock() {
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    if (!nav.wakeLock) return;

    let sentinel: { release: () => Promise<void> } | null = null;
    let released = false;

    const acquire = async () => {
      try {
        sentinel = await nav.wakeLock!.request("screen");
      } catch {
        // Denied (e.g. tab not visible, low battery) — degrade silently.
      }
    };

    // Re-acquire when the tab returns to the foreground: the lock is auto-released
    // by the browser whenever the page is hidden.
    const onVisible = () => { if (!released && document.visibilityState === "visible") acquire(); };

    acquire();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      sentinel?.release().catch(() => {});
    };
  }, []);

  return null;
}
