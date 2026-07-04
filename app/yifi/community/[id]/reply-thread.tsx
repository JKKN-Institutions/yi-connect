"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CommunityReply } from "@/lib/yifi/community/types";
import { addReply, toggleUpvote, markBest, flagItem } from "./actions";

interface ReplyThreadProps {
  postId: string;
  viewerIsAuthor: boolean;
  replies: CommunityReply[];
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReplyThread({ postId, viewerIsAuthor, replies }: ReplyThreadProps) {
  const router = useRouter();
  const [list, setList] = useState<CommunityReply[]>(replies);
  const [body, setBody] = useState("");
  const [anon, setAnon] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Re-sync with server truth whenever the server component re-renders (router.refresh()).
  useEffect(() => {
    setList(replies);
  }, [replies]);

  const sorted = [...list].sort((a, b) => {
    if (a.is_best && !b.is_best) return -1;
    if (b.is_best && !a.is_best) return 1;
    if ((b.upvote_count ?? 0) !== (a.upvote_count ?? 0)) {
      return (b.upvote_count ?? 0) - (a.upvote_count ?? 0);
    }
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });

  function handleUpvote(replyId: string) {
    setError("");
    const prev = list;
    setList((rs) =>
      rs.map((r) =>
        r.id === replyId
          ? {
              ...r,
              viewer_upvoted: !r.viewer_upvoted,
              upvote_count: (r.upvote_count ?? 0) + (r.viewer_upvoted ? -1 : 1),
            }
          : r,
      ),
    );
    startTransition(async () => {
      const res = await toggleUpvote(replyId, postId);
      if (res?.error) {
        setList(prev);
        setError(res.error);
      }
    });
  }

  function handleMarkBest(replyId: string) {
    setError("");
    const prev = list;
    setList((rs) => rs.map((r) => ({ ...r, is_best: r.id === replyId })));
    startTransition(async () => {
      const res = await markBest(postId, replyId);
      if (res?.error) {
        setList(prev);
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setError("");
    startTransition(async () => {
      const res = await addReply(postId, text, anon);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setBody("");
      setAnon(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-white">
          {sorted.length > 0
            ? `${sorted.length} ${sorted.length === 1 ? "reply" : "replies"}`
            : "Replies"}
        </h2>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-white/50 text-sm">
            No replies yet. Be the first to help.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((reply) => {
            const anonymous = !reply.author_name;
            const initial = anonymous
              ? "•"
              : reply.author_name!.charAt(0).toUpperCase();
            return (
              <div
                key={reply.id}
                className={`rounded-xl border p-4 transition-colors ${
                  reply.is_best
                    ? "border-[#229434]/50 bg-[#229434]/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                      anonymous ? "bg-white/10" : "bg-[#FD7215]/25"
                    }`}
                  >
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {anonymous ? "Anonymous" : reply.author_name}
                      </span>
                      {reply.is_best && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#229434]/20 px-2 py-0.5 text-xs font-medium text-[#229434]">
                          ✓ Best answer
                        </span>
                      )}
                      {reply.created_at && (
                        <span className="text-xs text-white/30">
                          {formatWhen(reply.created_at)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/90">
                      {reply.body}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleUpvote(reply.id)}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          reply.viewer_upvoted
                            ? "border-[#FD7215]/60 bg-[#FD7215]/15 text-[#FD7215]"
                            : "border-white/15 text-white/60 hover:border-white/30 hover:text-white"
                        }`}
                        aria-pressed={reply.viewer_upvoted}
                      >
                        <span aria-hidden>▲</span>
                        <span>{reply.upvote_count ?? 0}</span>
                        <span className="sr-only">upvotes</span>
                      </button>

                      {viewerIsAuthor && !reply.is_best && (
                        <button
                          type="button"
                          onClick={() => handleMarkBest(reply.id)}
                          disabled={isPending}
                          className="rounded-full border border-[#229434]/40 px-2.5 py-1 text-xs text-[#229434] transition-colors hover:bg-[#229434]/15 disabled:opacity-50"
                        >
                          Mark best answer
                        </button>
                      )}

                      <FlagButton postId={postId} replyId={reply.id} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reply composer */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-white/15 bg-white/5 p-4"
      >
        <label htmlFor="reply-body" className="sr-only">
          Write a reply
        </label>
        <textarea
          id="reply-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share your experience or advice…"
          rows={3}
          maxLength={4000}
          className="w-full resize-y rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-transparent focus:ring-2 focus:ring-[#FD7215]"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-white/60">
            <input
              type="checkbox"
              checked={anon}
              onChange={(e) => setAnon(e.target.checked)}
              className="h-4 w-4 rounded border-white/30 bg-white/10 accent-[#FD7215]"
            />
            Reply anonymously
          </label>
          <button
            type="submit"
            disabled={isPending || !body.trim()}
            className="rounded-lg bg-[#FD7215] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#e5660f] disabled:opacity-50"
          >
            {isPending ? "Posting…" : "Post reply"}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Small reusable report control. Used on the post (replyId omitted) and on each reply.
 * Exported so the server post-detail page can render it beside the post body.
 */
export function FlagButton({
  postId,
  replyId = null,
}: {
  postId: string;
  replyId?: string | null;
}) {
  const [phase, setPhase] = useState<"idle" | "open" | "sending" | "done" | "error">(
    "idle",
  );

  const REASONS = ["Spam", "Offensive", "Off-topic"];

  async function submit(reason: string) {
    setPhase("sending");
    const res = await flagItem(postId, replyId, reason);
    if (res?.error) {
      setPhase("error");
      return;
    }
    setPhase("done");
  }

  if (phase === "done") {
    return <span className="text-xs text-white/30">Reported ✓</span>;
  }

  if (phase === "idle") {
    return (
      <button
        type="button"
        onClick={() => setPhase("open")}
        className="text-xs text-white/30 transition-colors hover:text-white/60"
      >
        ⚑ Report
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-white/40">Reason:</span>
      {REASONS.map((r) => (
        <button
          key={r}
          type="button"
          disabled={phase === "sending"}
          onClick={() => submit(r)}
          className="rounded-full border border-white/20 px-2 py-0.5 text-xs text-white/70 transition-colors hover:border-white/40 hover:text-white disabled:opacity-50"
        >
          {r}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setPhase("idle")}
        className="text-xs text-white/30 hover:text-white/60"
      >
        Cancel
      </button>
      {phase === "error" && (
        <span className="text-xs text-red-400">Failed — retry</span>
      )}
    </span>
  );
}
