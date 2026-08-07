"use client";

import * as React from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/yip/utils";

export interface PersonOption {
  id: string;
  label: string;
  sublabel?: string;
}

const MAX_VISIBLE = 50;

/**
 * Type-to-search replacement for native <select> participant pickers.
 * Native selects only jump by first letter; this filters by case-insensitive
 * substring across label + sublabel. Keyboard (arrows + Enter + Escape),
 * click/tap select, clear button. No external deps.
 */
export function SearchablePersonSelect({
  options,
  value,
  onChange,
  placeholder = "Type to search…",
  disabled = false,
  className,
}: {
  options: PersonOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const listboxId = React.useId();

  const selected = React.useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value]
  );

  const { items, total } = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? options.filter((o) =>
          `${o.label} ${o.sublabel ?? ""}`.toLowerCase().includes(q)
        )
      : options;
    return { items: matches.slice(0, MAX_VISIBLE), total: matches.length };
  }, [options, query]);

  // Close on press outside.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  // Keep the active row visible during keyboard nav.
  React.useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = items[activeIndex];
      if (opt) pick(opt.id);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && items[activeIndex]
              ? `${listboxId}-${items[activeIndex].id}`
              : undefined
          }
          disabled={disabled}
          value={open ? query : selected?.label ?? ""}
          placeholder={selected ? selected.label : placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="h-9 w-full rounded-md border border-input bg-white px-3 pr-14 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              aria-label="Clear selection"
              onPointerDown={(e) => {
                // Run before the input blurs / dropdown closes.
                e.preventDefault();
                onChange("");
                setQuery("");
              }}
              className="rounded p-0.5 text-[#1a1a3e]/40 hover:text-[#1a1a3e]"
            >
              <X className="size-3.5" />
            </button>
          )}
          <ChevronDown className="size-4 text-[#1a1a3e]/40" aria-hidden="true" />
        </div>
      </div>
      {open && !disabled && (
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full min-w-48 overflow-auto rounded-md border border-input bg-white py-1 shadow-lg"
        >
          {items.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No matches
            </p>
          ) : (
            items.map((o, i) => (
              <div
                key={o.id}
                id={`${listboxId}-${o.id}`}
                role="option"
                aria-selected={o.id === value}
                data-index={i}
                onPointerDown={(e) => {
                  // preventDefault keeps the input from blurring first.
                  e.preventDefault();
                  pick(o.id);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "cursor-pointer px-3 py-1.5 text-sm",
                  i === activeIndex && "bg-[#FF9933]/10",
                  o.id === value && "font-medium"
                )}
              >
                <span className="text-[#1a1a3e]">{o.label}</span>
                {o.sublabel && (
                  <span className="ml-1.5 text-xs text-[#1a1a3e]/50">
                    {o.sublabel}
                  </span>
                )}
              </div>
            ))
          )}
          {total > MAX_VISIBLE && (
            <p className="border-t px-3 py-1.5 text-[11px] text-[#1a1a3e]/50">
              {total - MAX_VISIBLE} more — keep typing to narrow
            </p>
          )}
        </div>
      )}
    </div>
  );
}
