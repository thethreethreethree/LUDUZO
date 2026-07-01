"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };

// Registers the service worker (installability + offline static shell) and, when the
// browser offers it, surfaces an "Install app" button. Rendered inside the member portal.
export function PWARegister() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!deferred) return null;
  return (
    <button
      onClick={async () => {
        deferred.prompt();
        await deferred.userChoice.catch(() => {});
        setDeferred(null);
      }}
      className="flex items-center justify-center gap-2 rounded-xl border border-gold-line bg-gold-dim px-4 py-2.5 text-sm font-semibold text-gold"
    >
      ⤓ Install Luduzo on your phone
    </button>
  );
}
