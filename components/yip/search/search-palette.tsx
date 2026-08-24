"use client";

/**
 * YIP global search palette — the ⌘K box.
 *
 * This component is DISPLAY ONLY. Every authorization decision (which events
 * this viewer may match against, whether real participant names may be shown)
 * happens server-side in `searchYip`; a `SearchHit` arrives already redacted
 * and carries nothing but a title, an optional subtitle and an href. There is
 * deliberately no score, email, phone or access code anywhere in this file —
 * see lib/yip/search/types.ts for why search is treated as a leaky surface.
 *
 * COLOURS: the per-vertical brand tokens (bg-ivory / text-navy / bg-yi-gold)
 * are DEAD in this repo — app/yip/globals.css is imported nowhere — so every
 * colour below is a literal hex, matching app/yip/me/credential-ui.tsx
 * (INK #1a1a3e, SAFFRON #C2691A, GREEN #138808). Do not "tidy" these into
 * brand class names; they silently render as nothing.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  FileText,
  Flag,
  Gavel,
  HeartHandshake,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Scale,
  Search,
  Users,
  Users2,
  type LucideIcon,
} from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { searchYip } from "@/app/yip/actions/global-search";
import {
  SEARCH_GROUP_LABELS,
  SEARCH_GROUP_ORDER,
  SEARCH_MIN_QUERY,
  type SearchGroupKey,
  type SearchHit,
} from "@/lib/yip/search/types";

/** One icon per result group, so the eye can skip to the right block. */
const GROUP_ICONS: Record<SearchGroupKey, LucideIcon> = {
  events: CalendarDays,
  participants: Users,
  agenda: ListChecks,
  parties: Flag,
  committees: Users2,
  bills: FileText,
  questions: HelpCircle,
  motions: Gavel,
  jury: Scale,
  volunteers: HeartHandshake,
  ministries: Landmark,
  pages: LayoutDashboard,
};

/** Debounce window before we spend a database round-trip on a keystroke. */
const DEBOUNCE_MS = 300;

export type SearchPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SearchPalette({
  open,
  onOpenChange,
}: SearchPaletteProps): React.JSX.Element {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Out-of-order response guard. Server actions resolve in whatever order the
   * network feels like, so a slow request for "ma" can land AFTER a fast one
   * for "madurai" and overwrite the correct, newer results with stale ones.
   * Every request takes a sequence number; only the newest may write state.
   * (Same technique as app/yip/dashboard/global-search.tsx — it is a real bug
   * fix, not decoration.)
   */
  const seqRef = React.useRef(0);

  // Debounced search.
  React.useEffect(() => {
    if (!open) return;

    const q = query.trim();
    if (q.length < SEARCH_MIN_QUERY) {
      // Bumping the sequence here matters: it invalidates any request already
      // in flight, so backspacing to one character cannot be followed a moment
      // later by results for the longer query popping back into an empty box.
      seqRef.current += 1;
      setHits([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const seq = ++seqRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await searchYip(q);
        if (seq !== seqRef.current) return; // superseded by a newer query
        if (res.success) {
          setHits(res.hits);
          setError(null);
        } else {
          setHits([]);
          setError(res.error);
        }
      } catch {
        if (seq !== seqRef.current) return;
        setHits([]);
        // A thrown server action is a transport failure, which otherwise shows
        // the user absolutely nothing. Always surface something.
        setError("Search is unavailable right now. Please try again.");
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, open]);

  // Closing resets the box, so reopening never shows the last person's search.
  React.useEffect(() => {
    if (open) return;
    seqRef.current += 1; // also discards anything still in flight
    setQuery("");
    setHits([]);
    setError(null);
    setLoading(false);
  }, [open]);

  /** Bucket the flat hit list, then emit buckets in the canonical order. */
  const groups = React.useMemo(() => {
    const buckets = new Map<SearchGroupKey, SearchHit[]>();
    for (const hit of hits) {
      const existing = buckets.get(hit.group);
      if (existing) existing.push(hit);
      else buckets.set(hit.group, [hit]);
    }
    return SEARCH_GROUP_ORDER.map(
      (group) => ({ group, rows: buckets.get(group) ?? [] }),
    ).filter((bucket) => bucket.rows.length > 0);
  }, [hits]);

  const handleSelect = React.useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router],
  );

  const trimmed = query.trim();
  const isIdle = trimmed.length < SEARCH_MIN_QUERY;
  const showSpinnerRow = loading && hits.length === 0 && !isIdle && !error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden border-[#1a1a3e]/10 p-0 shadow-2xl sm:max-w-2xl"
      >
        {/* The dialog still needs a programmatic name even though nothing is
            drawn: Radix warns without a DialogTitle, and screen readers would
            otherwise announce an unlabelled dialog. */}
        <DialogHeader className="sr-only">
          <DialogTitle>Search YIP</DialogTitle>
          <DialogDescription>
            Search events, participants, sessions and pages you have access to.
          </DialogDescription>
        </DialogHeader>

        <Command
          /**
           * cmdk filters its own children client-side by default. Our rows are
           * ALREADY filtered and ranked by the server against the viewer's
           * scope, and a hit's visible title is often a redaction
           * ("Participant 115") that does not contain the typed text at all —
           * so cmdk's matcher would hide perfectly valid results. Turn it off
           * and trust the server's ordering.
           */
          shouldFilter={false}
          className="bg-white"
          onKeyDown={(event) => {
            // Radix already closes on Escape; this is a belt-and-braces path
            // for the case where cmdk's input swallows the key first.
            if (event.key === "Escape") onOpenChange(false);
          }}
        >
          <div className="relative">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search events, participants, sessions…"
              className="text-[#1a1a3e] placeholder:text-[#1a1a3e]/35"
            />
            {loading && (
              <Loader2
                aria-hidden="true"
                className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-[#C2691A]"
              />
            )}
          </div>

          <CommandList className="max-h-[24rem] px-1 pb-2">
            {error ? (
              <p
                role="alert"
                className="px-4 py-8 text-center text-sm text-[#b3261e]"
              >
                {error}
              </p>
            ) : isIdle ? (
              <p className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-[#1a1a3e]/45">
                <Search aria-hidden="true" className="size-5 opacity-40" />
                Type at least {SEARCH_MIN_QUERY} characters to search.
              </p>
            ) : showSpinnerRow ? (
              <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-[#1a1a3e]/45">
                <Loader2
                  aria-hidden="true"
                  className="size-4 animate-spin text-[#C2691A]"
                />
                Searching…
              </p>
            ) : (
              <>
                {/* Rendered only when zero CommandItems exist. With
                    shouldFilter={false} cmdk sets filtered.count to the mounted
                    item count, so this is exact rather than filter-dependent. */}
                <CommandEmpty className="px-4 py-10 text-sm text-[#1a1a3e]/45">
                  No matches
                </CommandEmpty>

                {groups.map(({ group, rows }) => {
                  const Icon = GROUP_ICONS[group];
                  return (
                    <CommandGroup
                      key={group}
                      heading={SEARCH_GROUP_LABELS[group]}
                      className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-[#1a1a3e]/40"
                    >
                      {rows.map((hit) => (
                        <CommandItem
                          // Group-qualified: a hit id is only unique within its
                          // own group, and cmdk uses `value` as row identity.
                          key={`${hit.group}:${hit.id}`}
                          value={`${hit.group}:${hit.id}`}
                          onSelect={() => handleSelect(hit.href)}
                          className="cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 data-[selected=true]:bg-[#C2691A]/10 data-[selected=true]:text-[#1a1a3e]"
                        >
                          <Icon
                            aria-hidden="true"
                            className="size-4 shrink-0 text-[#C2691A]"
                          />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium text-[#1a1a3e]">
                              {hit.title}
                            </span>
                            {hit.subtitle ? (
                              <span className="truncate text-xs text-[#1a1a3e]/45">
                                {hit.subtitle}
                              </span>
                            ) : null}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </>
            )}
          </CommandList>

          <div className="flex items-center justify-between border-t border-[#1a1a3e]/10 px-3 py-2 text-[11px] text-[#1a1a3e]/40">
            <span>
              <kbd className="font-sans">↑</kbd>{" "}
              <kbd className="font-sans">↓</kbd> to navigate ·{" "}
              <kbd className="font-sans">↵</kbd> to open
            </span>
            <span>
              <kbd className="font-sans">Esc</kbd> to close
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
