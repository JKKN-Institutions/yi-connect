"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Every jury screen opens at the top.
 *
 * WHY THIS EXISTS
 * The scoring page is TALL on a phone: the quick-jump bar is fixed to the
 * bottom and the content reserves a measured clearance under it (~550px with
 * the digit pad open). A juror therefore spends the session scrolled down —
 * that is where the criteria and Submit are.
 *
 * The browser's default `history.scrollRestoration = "auto"` then restores that
 * position on every reload, back-navigation, and PWA resume. YIP is an
 * installed standalone PWA with no browser chrome, so a juror coming back to
 * the app lands mid-page with the header off-screen and no obvious way to tell
 * where they are. It reads as "the page always scrolls to the bottom".
 *
 * Two parts, and both are needed:
 *   • scrollRestoration = "manual" stops the browser restoring the old offset
 *     BEFORE we get a chance to run (setting scrollTo alone loses the race);
 *   • an explicit scrollTo(0, 0) on mount and on every jury route change.
 *
 * Scoped to the jury lane only — mounted in app/yip/jury/(authed)/layout.tsx.
 * It deliberately does NOT run on participant switch: the juror stays where
 * they are while marking, which is the whole point of the fast-switch work.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof history !== "undefined" && "scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    // `instant` rather than smooth: this is a page arriving, not a movement
    // the juror asked for, and a visible glide on every open is worse than
    // simply already being at the top.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
