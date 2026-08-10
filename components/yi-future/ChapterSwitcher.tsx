"use client";

// National-admin chapter switch, rendered in the chapter admin shell.
//
// Only rendered when the server passed a non-empty chapter list, and
// listSwitchableChapters() returns [] for anyone who is not national — so a
// chapter admin never sees this control at all.
//
// When a national admin is standing in someone else's chapter the strip turns
// amber and says whose chapter it is. That is the point of the component: the
// screens look identical whichever chapter you are in, and an admin editing
// the wrong chapter's delegates would have no way to tell.

import { useState, useTransition } from "react";
import {
  setAdminChapter,
  type SwitchableChapter,
} from "@/app/yi-future/actions/admin-chapter";

export function ChapterSwitcher({
  chapters,
  currentChapterId,
  currentChapterName,
  viewingAsNational,
}: {
  chapters: SwitchableChapter[];
  currentChapterId: string | null;
  currentChapterName: string | null;
  viewingAsNational: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (chapters.length === 0) return null;

  function switchTo(value: string) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await setAdminChapter(value || null);
        if (!res.ok) setError(res.error);
      } catch {
        setError("Couldn't switch chapter — check your connection.");
      }
    });
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 px-4 py-2 text-xs border-b ${
        viewingAsNational
          ? "bg-[#F5A623]/15 border-[#F5A623]/40"
          : "bg-white border-navy/10"
      }`}
    >
      {viewingAsNational ? (
        <span className="font-bold text-navy">
          👁 Viewing <strong>{currentChapterName}</strong> as national admin
        </span>
      ) : (
        <span className="font-semibold text-navy/60">Open a chapter</span>
      )}

      <select
        aria-label="Switch chapter"
        value={viewingAsNational ? (currentChapterId ?? "") : ""}
        disabled={pending}
        onChange={(e) => switchTo(e.target.value)}
        className="px-2 py-1 border border-navy/20 rounded-md bg-white text-navy max-w-[220px]"
      >
        <option value="">
          {viewingAsNational ? "← Back to my own chapter" : "Select a chapter…"}
        </option>
        {chapters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.city ? ` — ${c.city}` : ""}
          </option>
        ))}
      </select>

      {pending && <span className="text-navy/50">Switching…</span>}
      {error && <span className="text-red-600 font-semibold">{error}</span>}
    </div>
  );
}
