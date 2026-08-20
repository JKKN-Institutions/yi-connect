"use client";

/**
 * The visible entry point to YIP global search.
 *
 * Owns the palette's open state and renders <SearchPalette> itself, so putting
 * <SearchTrigger /> in a layout is the whole integration — no state to thread
 * through, nothing else to mount.
 *
 * COLOURS are literal hex on purpose: the per-vertical brand tokens
 * (bg-ivory / text-navy / bg-yi-gold) are dead in this repo because
 * app/yip/globals.css is imported nowhere. INK #1a1a3e, SAFFRON #C2691A.
 */

import * as React from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { SearchPalette } from "./search-palette";

export type SearchTriggerProps = {
  className?: string;
  /**
   * "box" (default) — a full search field for the organiser dashboard, which
   * has header room to spare.
   * "icon" — a single 44×44 button for the jury / participant / volunteer
   * lanes. Those run on phones, inside a 56px header that already carries the
   * lane title and its nav, and a full field would crowd both. The palette that
   * opens is identical either way.
   */
  variant?: "box" | "icon";
};

export function SearchTrigger({
  className,
  variant = "box",
}: SearchTriggerProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  /**
   * Which modifier key to show in the hint chip.
   *
   * Deliberately NULL until after mount. Deciding this during render reads
   * `navigator`, which the server also has — Node 20+ defines a global
   * `navigator`, so the usual `typeof navigator !== "undefined"` guard does
   * NOT save you: the server happily takes the browser branch, guesses the
   * wrong platform, and the client hydrates a different string. This repo has
   * a documented hydration bug from exactly that. So: render a neutral,
   * fixed-width placeholder first, then swap the real key in an effect.
   */
  const [modifierKey, setModifierKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    setModifierKey(
      /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "⌘" : "Ctrl",
    );
  }, []);

  // ⌘K / Ctrl-K toggles the palette from anywhere on the page.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        // Chrome focuses the address bar on ⌘K unless we claim it.
        event.preventDefault();
        setOpen((wasOpen) => !wasOpen);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Search YIP"
          aria-keyshortcuts="Meta+K Control+K"
          title="Search"
          className={cn(
            // 44×44 is the minimum comfortable touch target on a phone, which
            // is the only device these lanes are used on.
            "flex size-11 items-center justify-center rounded-lg text-[#1a1a3e]/50 transition-colors hover:bg-[#1a1a3e]/5 hover:text-[#C2691A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2691A]/25",
            className,
          )}
        >
          <Search aria-hidden="true" className="size-5" />
        </button>

        <SearchPalette open={open} onOpenChange={setOpen} />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search YIP"
        aria-keyshortcuts="Meta+K Control+K"
        className={cn(
          "group flex h-9 w-full items-center gap-2 rounded-xl border border-[#1a1a3e]/10 bg-white px-3 text-left shadow-sm transition-colors hover:border-[#C2691A]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2691A]/25 sm:w-64",
          className,
        )}
      >
        <Search
          aria-hidden="true"
          className="size-4 shrink-0 text-[#1a1a3e]/35 transition-colors group-hover:text-[#C2691A]"
        />
        <span className="flex-1 truncate text-sm text-[#1a1a3e]/40">
          Search…
        </span>
        {/* Fixed min-width keeps the chip from resizing when the real key
            arrives after mount, so nothing jumps on hydration. */}
        <kbd
          aria-hidden="true"
          className="hidden min-w-[2.75rem] rounded-md border border-[#1a1a3e]/10 bg-[#1a1a3e]/[0.03] px-1.5 py-0.5 text-center font-sans text-[10px] font-medium text-[#1a1a3e]/40 sm:inline-block"
        >
          {modifierKey === null ? " " : modifierKey}K
        </kbd>
      </button>

      <SearchPalette open={open} onOpenChange={setOpen} />
    </>
  );
}
