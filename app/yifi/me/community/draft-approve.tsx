"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveDraft, discardDraft } from "@/app/yifi/community/actions";

/** A census-seeded draft row from yifi_community_list_my_drafts. */
export interface DraftPost {
  id: string;
  title: string;
  body: string;
  sector: string | null;
  source_challenge: string | null;
  is_anonymous: boolean;
}

export function DraftApprove({ draft }: { draft: DraftPost }) {
  const [title, setTitle] = useState(draft.title ?? "");
  const [body, setBody] = useState(draft.body ?? "");
  const [sector, setSector] = useState(draft.sector ?? "");
  const [isAnonymous, setIsAnonymous] = useState(Boolean(draft.is_anonymous));
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleApprove() {
    setError("");
    startTransition(async () => {
      const result = await approveDraft({
        postId: draft.id,
        title: title.trim(),
        body: body.trim(),
        sector: sector.trim() || null,
        isAnonymous,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDiscard() {
    setError("");
    startTransition(async () => {
      const result = await discardDraft(draft.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="bg-white/5 border border-dashed border-white/20 rounded-xl p-4 space-y-3">
      <span className="inline-block text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#FD7215]/20 text-[#FD7215] border border-[#FD7215]/30">
        Starter challenge
      </span>

      <div>
        <label className="text-white/50 text-[11px] uppercase tracking-wide mb-1 block">
          Title
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-[#FD7215] focus:border-transparent"
          disabled={isPending}
        />
      </div>

      <div>
        <label className="text-white/50 text-[11px] uppercase tracking-wide mb-1 block">
          Details
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-[#FD7215] focus:border-transparent resize-y"
          disabled={isPending}
        />
      </div>

      <div>
        <label className="text-white/50 text-[11px] uppercase tracking-wide mb-1 block">
          Sector (optional)
        </label>
        <input
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          maxLength={80}
          placeholder="e.g. SaaS, Retail"
          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-[#FD7215] focus:border-transparent"
          disabled={isPending}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isAnonymous}
          onChange={(e) => setIsAnonymous(e.target.checked)}
          className="w-4 h-4 accent-[#FD7215]"
          disabled={isPending}
        />
        <span className="text-white/60 text-xs">Share anonymously</span>
      </label>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isPending || !title.trim() || !body.trim()}
          className="flex-1 py-2 bg-[#FD7215] text-white text-sm font-medium rounded-lg hover:bg-[#e5660f] disabled:opacity-50 transition-colors"
        >
          {isPending ? "..." : "Approve & share"}
        </button>
        <button
          type="button"
          onClick={handleDiscard}
          disabled={isPending}
          className="px-4 py-2 bg-white/5 text-white/60 text-sm rounded-lg border border-white/15 hover:border-white/30 disabled:opacity-50 transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
