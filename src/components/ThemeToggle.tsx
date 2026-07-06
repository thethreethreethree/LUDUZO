"use client";

import { useCallback, useSyncExternalStore } from "react";

// Toggles LUDUZO's Light/Dark theme by flipping the `.dark` class on <html> and
// persisting the choice to localStorage (read back by the no-flash script in the
// root layout on the next load). The current theme is read from the DOM via
// useSyncExternalStore — the React-sanctioned way to read browser-only state without
// a hydration mismatch: server + first client render use the null placeholder, then
// it swaps to the real icon after commit. The member portal pins `.dark`, so this
// control is not shown there (and its per-gym branding is never overridden).

const THEME_EVENT = "luduzo-theme-change";

function subscribe(cb: () => void) {
  window.addEventListener(THEME_EVENT, cb);
  window.addEventListener("storage", cb); // reflect a change made in another tab
  return () => {
    window.removeEventListener(THEME_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

// No DOM on the server (or during the hydration pass): render the neutral placeholder
// so SSR and first client render match; getSnapshot then supplies the real value.
function getServerSnapshot(): boolean | null {
  return null;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const dark = useSyncExternalStore<boolean | null>(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("luduzo-theme", next ? "dark" : "light");
    } catch {
      /* private mode / storage disabled — the class still flips for this session */
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const label =
    dark === null ? "Toggle theme" : dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`grid h-8.5 w-8.5 place-items-center rounded-full border border-iron text-ash transition-colors hover:border-gold hover:text-gold ${className}`}
    >
      {dark === null ? (
        <span className="h-4 w-4" aria-hidden />
      ) : dark ? (
        // Sun — offered action is "go light"
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        // Moon — offered action is "go dark"
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
