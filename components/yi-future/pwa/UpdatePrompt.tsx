"use client";

import { useEffect, useState } from "react";

/**
 * Listens for a waiting service worker (new version downloaded but not yet
 * active) and shows a "New version available — Reload" banner. On Reload,
 * we post SKIP_WAITING to the waiting SW and reload the page when the new
 * SW takes control.
 */
export function UpdatePrompt() {
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let reloading = false;

    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange
    );

    const trackWaiting = (reg: ServiceWorkerRegistration) => {
      // If a SW is already waiting AND a controller exists, this is an update.
      if (reg.waiting && navigator.serviceWorker.controller) {
        setUpdateAvailable(true);
      }
    };

    const onUpdateFound = (reg: ServiceWorkerRegistration) => () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (
          installing.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          setUpdateAvailable(true);
        }
      });
    };

    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (!reg) return;
        setRegistration(reg);
        trackWaiting(reg);
        reg.addEventListener("updatefound", onUpdateFound(reg));
        // Force a check for an updated SW on mount.
        reg.update().catch(() => {
          /* network may be offline — ignore */
        });
      })
      .catch(() => {
        /* registration unavailable — ignore */
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);

  const show = mounted && updateAvailable && !dismissed;

  if (!show) return null;

  const handleReload = () => {
    const waiting = registration?.waiting;
    if (waiting) {
      waiting.postMessage({ type: "SKIP_WAITING" });
      // controllerchange listener will reload the page once the new SW
      // takes over.
    } else {
      // No waiting SW found (edge case) — fall back to a manual reload.
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <div
      role="dialog"
      aria-label="New version available"
      className="fixed inset-x-0 z-50 px-3 pointer-events-none"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
      }}
    >
      <div className="pointer-events-auto mx-auto max-w-md rounded-lg bg-[#1a1a3e] text-[#fdf9ed] shadow-lg ring-1 ring-black/10">
        <div className="flex items-center gap-3 p-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-[#d4a017]/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="h-5 w-5 text-[#d4a017]"
            >
              <path
                fillRule="evenodd"
                d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0v2.43l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1 text-sm leading-snug">
            <p className="font-semibold">New version available</p>
            <p className="text-xs opacity-90">
              Reload to get the latest YiFuture.
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={handleReload}
              className="rounded-md bg-[#d4a017] px-3 py-1.5 text-xs font-semibold text-[#1a1a3e] hover:bg-[#c39214] focus:outline-none focus:ring-2 focus:ring-[#d4a017] focus:ring-offset-2 focus:ring-offset-[#1a1a3e]"
            >
              Reload
            </button>
            <button
              type="button"
              aria-label="Dismiss update prompt"
              onClick={handleDismiss}
              className="rounded-md p-1.5 text-[#fdf9ed]/80 hover:bg-white/10 hover:text-[#fdf9ed] focus:outline-none focus:ring-2 focus:ring-[#fdf9ed]/40"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M4.28 3.22a.75.75 0 0 0-1.06 1.06L8.94 10l-5.72 5.72a.75.75 0 1 0 1.06 1.06L10 11.06l5.72 5.72a.75.75 0 1 0 1.06-1.06L11.06 10l5.72-5.72a.75.75 0 0 0-1.06-1.06L10 8.94 4.28 3.22Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UpdatePrompt;
