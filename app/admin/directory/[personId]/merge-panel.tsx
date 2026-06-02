/**
 * Directory Admin — Merge Panel (2026-06-02)
 *
 * "Fold a duplicate INTO this person." This person is the canonical TARGET;
 * the picked person is the duplicate SOURCE (deactivated + re-pointed by the
 * atomic merge_directory_people function). Platform-super gated server-side.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GitMerge, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  searchPeopleForMerge,
  mergePeople,
  type MergeCandidate,
} from "../actions/directory-mutations";

export function MergePanel({
  targetId,
  targetName,
}: {
  targetId: string;
  targetName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MergeCandidate[]>([]);
  const [picked, setPicked] = useState<MergeCandidate | null>(null);

  function doSearch() {
    startTransition(async () => {
      setResults(await searchPeopleForMerge(q, targetId));
    });
  }

  function doMerge() {
    if (!picked) return;
    startTransition(async () => {
      const res = await mergePeople(picked.id, targetId, false);
      if (res.success) {
        toast.success(res.message ?? "Merged");
        setPicked(null);
        setResults([]);
        setQ("");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
      >
        <GitMerge className="h-3.5 w-3.5" /> Merge a duplicate into this person
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-amber-900">
          Merge a duplicate into {targetName}
        </h3>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setPicked(null);
            setResults([]);
          }}
          className="text-xs text-slate-500 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>

      {picked ? (
        <div className="space-y-3">
          <p className="text-sm text-amber-900">
            Merge <strong>{picked.full_name}</strong>
            {picked.email ? ` (${picked.email})` : ""} into{" "}
            <strong>{targetName}</strong>? The duplicate will be{" "}
            <strong>deactivated</strong> and all its roles, links, and login
            moved here. This cannot be undone.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={doMerge}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {pending ? "Merging…" : "Confirm merge"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setPicked(null)}
            >
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              doSearch();
            }}
            className="relative"
          >
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the duplicate by name or email…"
              className="pl-8"
            />
          </form>
          {results.length > 0 ? (
            <ul className="divide-y divide-amber-100 rounded-md border border-amber-100 bg-white">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setPicked(r)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-amber-50"
                  >
                    <span className="text-sm font-medium text-slate-900">
                      {r.full_name}
                      {!r.is_active ? (
                        <span className="ml-1 text-xs text-slate-400">
                          (inactive)
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-slate-500">
                      {r.email ?? "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : q && !pending ? (
            <p className="text-xs text-slate-500">
              Search, then pick the duplicate to fold in.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
