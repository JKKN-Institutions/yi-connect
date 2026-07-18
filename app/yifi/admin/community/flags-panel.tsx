"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { resolveFlag, revealAuthor, type RealAuthor } from "./actions";

/**
 * Normalized flag row shown in the moderation queue. The page.tsx server
 * component normalizes the raw admin_list_flags rows into this shape (the flag
 * JSON schema is owned by Agent 1's RPC, so page-side normalization is
 * defensive about field names).
 */
export interface AdminFlag {
  id: string;
  post_id: string | null;
  reply_id: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  flagger_name: string | null;
  content_title: string | null;
  content_body: string | null;
  content_kind: "post" | "reply";
}

function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FlagsPanel({ flags }: { flags: AdminFlag[] }) {
  if (flags.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
        <p className="text-white/40 text-sm">No open flags. The board is clean.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {flags.map((flag) => (
        <FlagCard key={flag.id} flag={flag} />
      ))}
    </div>
  );
}

function FlagCard({ flag }: { flag: AdminFlag }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [author, setAuthor] = useState<RealAuthor | null>(null);
  const [revealing, setRevealing] = useState(false);

  function act(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleReveal() {
    setError(null);
    setRevealing(true);
    startTransition(async () => {
      const res = await revealAuthor(
        flag.content_kind === "post" ? flag.post_id : null,
        flag.content_kind === "reply" ? flag.reply_id : null
      );
      setRevealing(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAuthor(res.author);
    });
  }

  const targetHref = flag.post_id ? `/yifi/community/${flag.post_id}` : null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300">
              {flag.content_kind}
            </span>
            <span className="text-white/40 text-xs">
              flagged by {flag.flagger_name || "someone"}
            </span>
            {flag.created_at && (
              <span className="text-white/30 text-xs">
                · {formatDate(flag.created_at)}
              </span>
            )}
          </div>
          {flag.reason && (
            <p className="text-white/70 text-sm">
              <span className="text-white/40">Reason: </span>
              {flag.reason}
            </p>
          )}
        </div>
      </div>

      {/* Flagged content preview */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
        {flag.content_title && (
          <p className="text-white text-sm font-medium">{flag.content_title}</p>
        )}
        {flag.content_body && (
          <p className="text-white/60 text-sm mt-1 line-clamp-4 whitespace-pre-wrap">
            {flag.content_body}
          </p>
        )}
        {!flag.content_title && !flag.content_body && (
          <p className="text-white/30 text-sm italic">Content unavailable.</p>
        )}
      </div>

      {author && (
        <div className="rounded-lg border border-[#FD7215]/30 bg-[#FD7215]/10 p-3 text-sm">
          <p className="text-[#FD7215] font-medium">
            {author.full_name || "Unknown"}
          </p>
          {author.email && <p className="text-white/60 text-xs">{author.email}</p>}
        </div>
      )}

      {error && <p className="text-red-300 text-xs">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => act(() => resolveFlag(flag.id, "resolved"))}
          disabled={pending}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#229434]/20 text-[#229434] hover:bg-[#229434]/30 disabled:opacity-50 transition-colors"
        >
          Resolve
        </button>
        <button
          type="button"
          onClick={() => act(() => resolveFlag(flag.id, "dismissed"))}
          disabled={pending}
          className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/70 hover:border-white/40 hover:text-white disabled:opacity-50 transition-colors"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={handleReveal}
          disabled={pending || (!flag.post_id && !flag.reply_id)}
          className="text-xs px-3 py-1.5 rounded-lg border border-[#FD7215]/30 text-[#FD7215] hover:bg-[#FD7215]/10 disabled:opacity-50 transition-colors"
        >
          {revealing ? "Revealing…" : "Reveal author"}
        </button>
        {targetHref && (
          <Link
            href={targetHref}
            target="_blank"
            className="text-xs px-3 py-1.5 rounded-lg text-white/50 hover:text-white transition-colors"
          >
            Open post ↗
          </Link>
        )}
      </div>
    </div>
  );
}
