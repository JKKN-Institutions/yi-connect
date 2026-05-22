"use client";

import { useEffect, useState } from "react";

/**
 * BeforeInstallPromptEvent is non-standard (Chromium-only).
 * We model the minimal surface we use.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

const DISMISS_KEY = "pwa_install_dismissed";
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getIsStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  // iOS Safari exposes navigator.standalone (non-standard).
  const iosStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(mq || iosStandalone);
}

function getIsIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIos = /iphone|ipad|ipod/i.test(ua);
  // MSStream check excludes IE-on-Windows masquerading as iOS.
  const noMsStream = !(window as Window & { MSStream?: unknown }).MSStream;
  return isIos && noMsStream;
}

function isDismissedRecently(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < DISMISS_MS;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(true); // assume dismissed until we check (avoid SSR flash)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsStandalone(getIsStandalone());
    setIsIos(getIsIos());
    setDismissed(isDismissedRecently());

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const show =
    mounted &&
    !isStandalone &&
    !dismissed &&
    (installPromptEvent !== null || isIos);

  if (!show) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {
      /* localStorage unavailable — still hide for this session */
    }
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (!installPromptEvent) return;
    try {
      await installPromptEvent.prompt();
      await installPromptEvent.userChoice;
    } catch {
      /* user-agent may throw if called twice; fail quiet */
    }
    setInstallPromptEvent(null);
    // Treat any interaction with the prompt as a "stop nagging" signal too.
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {
      /* noop */
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Install YiFuture"
      className="fixed inset-x-0 z-50 px-3 pointer-events-none"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
      }}
    >
      <div className="pointer-events-auto mx-auto max-w-md rounded-lg bg-[#1a1a3e] text-[#fdf9ed] shadow-lg ring-1 ring-black/10">
        <div className="flex items-center gap-3 p-3">
          <img
            src="/icons/future-6-icon-192.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 flex-shrink-0 rounded-md"
          />
          <div className="min-w-0 flex-1 text-sm leading-snug">
            {isIos && !installPromptEvent ? (
              <>
                <p className="font-semibold">Install on iPhone</p>
                <p className="text-xs opacity-90">
                  Tap the Share icon, then choose &ldquo;Add to Home
                  Screen&rdquo;.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">Install YiFuture</p>
                <p className="text-xs opacity-90">
                  Quick access from your home screen.
                </p>
              </>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {installPromptEvent ? (
              <button
                type="button"
                onClick={handleInstall}
                className="rounded-md bg-[#d4a017] px-3 py-1.5 text-xs font-semibold text-[#1a1a3e] hover:bg-[#c39214] focus:outline-none focus:ring-2 focus:ring-[#d4a017] focus:ring-offset-2 focus:ring-offset-[#1a1a3e]"
              >
                Install
              </button>
            ) : isIos ? (
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-md bg-[#d4a017] px-3 py-1.5 text-xs font-semibold text-[#1a1a3e] hover:bg-[#c39214] focus:outline-none focus:ring-2 focus:ring-[#d4a017] focus:ring-offset-2 focus:ring-offset-[#1a1a3e]"
              >
                Got it
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Dismiss install prompt"
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

export default InstallPrompt;
