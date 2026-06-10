"use client";

/**
 * Institution picker for the NATIONAL academy form.
 *
 * Three modes (spec: optional institution; "Other" free text; ask-to-add):
 *   - search the canonical master (yi.institutions) via searchInstitutions
 *   - "Other" free text → stored as academies.institution_other
 *   - "Request to add" → requestInstitutionAdd inserts into the master
 *     (has_yuva_chapter=true, provenance in notes) and selects the new row
 */

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  searchInstitutions,
  requestInstitutionAdd,
} from "@/app/youth-academy/actions/institutions";

export type InstitutionSelection = {
  institution_id: string | null;
  /** Display name of the selected canonical institution (for previews). */
  institution_name: string | null;
  /** Free-text fallback when no canonical institution is selected. */
  institution_other: string | null;
};

type Hit = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
};

export function InstitutionPicker({
  value,
  onChange,
}: {
  value: InstitutionSelection;
  onChange: (next: InstitutionSelection) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [otherMode, setOtherMode] = useState(Boolean(value.institution_other));
  const [requesting, setRequesting] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced master search — short queries clear results in onQueryChange
  // (not here) so the effect only talks to the external system.
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
      institution_id: hit.id,
      institution_name: hit.name,
      institution_other: null,
    });
    setQuery("");
    setHits([]);
    setOtherMode(false);
  }

  function clear() {
    onChange({
      institution_id: null,
      institution_name: null,
      institution_other: null,
    });
    setOtherMode(false);
  }

  async function requestAdd() {
    const name = query.trim();
    if (name.length < 3) {
      toast.error("Type the institution's full name first.");
      return;
    }
    setRequesting(true);
    const result = await requestInstitutionAdd({ name });
    setRequesting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (result.warning) toast(result.warning);
    else toast.success(`"${result.data.name}" added for national curation.`);
    select(result.data);
  }

  // Selected canonical institution → summary chip.
  if (value.institution_id) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Check className="size-4 shrink-0 text-emerald-600" />
          <span className="truncate text-sm font-medium text-emerald-900">
            {value.institution_name ?? "Selected institution"}
          </span>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          <X className="size-4" />
          <span className="sr-only">Clear institution</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!otherMode ? (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search the YUVA institution list…"
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
            <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
              No match in the institution list.
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={requestAdd}
                  disabled={requesting}
                >
                  {requesting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Add “{query.trim()}” to the list
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setOtherMode(true);
                    onChange({
                      institution_id: null,
                      institution_name: null,
                      institution_other: query.trim(),
                    });
                  }}
                >
                  Use as free text instead
                </Button>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setOtherMode(true)}
            className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
          >
            Other — type a name without adding it to the list
          </button>
        </>
      ) : (
        <div className="space-y-1">
          <Label htmlFor="institution-other" className="text-xs text-slate-500">
            Institution name (free text)
          </Label>
          <div className="flex gap-2">
            <Input
              id="institution-other"
              value={value.institution_other ?? ""}
              onChange={(e) =>
                onChange({
                  institution_id: null,
                  institution_name: null,
                  institution_other: e.target.value,
                })
              }
              placeholder="e.g. ABC College of Engineering"
            />
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              <X className="size-4" />
              <span className="sr-only">Clear</span>
            </Button>
          </div>
          <button
            type="button"
            onClick={() => {
              setOtherMode(false);
              onChange({
                institution_id: null,
                institution_name: null,
                institution_other: null,
              });
            }}
            className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
          >
            Back to search
          </button>
        </div>
      )}
    </div>
  );
}
