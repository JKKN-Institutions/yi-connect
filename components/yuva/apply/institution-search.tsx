"use client";

/**
 * Institution picker for the PUBLIC apply form (Phase 8) — search the
 * canonical master (yi.institutions via searchInstitutions, a public action)
 * + "Other" free text. Deliberately has NO "request to add" path: that
 * action is chapter/national-gated (anonymous applicants type free text and
 * national curates later).
 *
 * Slimmed from components/yuva/academies/institution-picker.tsx.
 */

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchInstitutions } from "@/app/youth-academy/actions/institutions";

export type InstitutionValue = {
  institutionId: string | null;
  institutionName: string | null;
  institutionOther: string | null;
};

type Hit = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
};

export function InstitutionSearch({
  value,
  onChange,
}: {
  value: InstitutionValue;
  onChange: (next: InstitutionValue) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [otherMode, setOtherMode] = useState(Boolean(value.institutionOther));
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      const result = await searchInstitutions(q);
      setSearching(false);
      if (result.success) setHits(result.data);
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  function onQueryChange(next: string) {
    setQuery(next);
    if (next.trim().length < 2) setHits([]);
  }

  function select(hit: Hit) {
    onChange({
      institutionId: hit.id,
      institutionName: hit.name,
      institutionOther: null,
    });
    setQuery("");
    setHits([]);
    setOtherMode(false);
  }

  function clear() {
    onChange({
      institutionId: null,
      institutionName: null,
      institutionOther: null,
    });
    setOtherMode(false);
  }

  if (value.institutionId) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Check className="size-4 shrink-0 text-emerald-600" />
          <span className="truncate text-sm font-medium text-emerald-900">
            {value.institutionName ?? "Selected institution"}
          </span>
        </div>
        <button
          type="button"
          onClick={clear}
          className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
        >
          <X className="size-4" />
          <span className="sr-only">Clear institution</span>
        </button>
      </div>
    );
  }

  if (otherMode) {
    return (
      <div className="space-y-1.5">
        <Label
          htmlFor="apply-institution-other"
          className="text-xs text-slate-500"
        >
          Institution name
        </Label>
        <div className="flex gap-2">
          <Input
            id="apply-institution-other"
            value={value.institutionOther ?? ""}
            onChange={(e) =>
              onChange({
                institutionId: null,
                institutionName: null,
                institutionOther: e.target.value,
              })
            }
            placeholder="e.g. ABC College of Engineering"
          />
          <button
            type="button"
            onClick={clear}
            className="rounded-lg border border-slate-200 px-2.5 text-slate-500 hover:bg-slate-50"
          >
            <X className="size-4" />
            <span className="sr-only">Clear</span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setOtherMode(false);
            onChange({
              institutionId: null,
              institutionName: null,
              institutionOther: null,
            });
          }}
          className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
        >
          Back to search
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search for your college / institution…"
          className="pl-9"
        />
        {searching ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate-400" />
        ) : null}
      </div>
      {hits.length > 0 ? (
        <ul className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                onClick={() => select(hit)}
                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="text-sm font-medium text-slate-900">
                  {hit.name}
                </span>
                {(hit.city || hit.state) && (
                  <span className="text-xs text-slate-400">
                    {[hit.city, hit.state].filter(Boolean).join(", ")}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {query.trim().length >= 3 && !searching && hits.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
          No match found — use the option below to type your institution&apos;s
          name.
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => setOtherMode(true)}
        className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
      >
        My institution isn&apos;t in the list — type it instead
      </button>
    </div>
  );
}
