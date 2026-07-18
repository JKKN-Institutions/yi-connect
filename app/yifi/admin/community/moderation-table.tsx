"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CommunityPost, CommunityReply, PostStatus } from "@/lib/yifi/community/types";
import {
  seedDrafts,
  setStatus,
  removeReply,
  loadReplies,
  suggestHelpers,
} from "./actions";

/* ------------------------------------------------------------------ */
/* (a) Seed starter challenges button                                  */
/* ------------------------------------------------------------------ */

export function SeedStarterButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSeed() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await seedDrafts();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(
        res.count === 0
          ? "No new drafts — every census challenge is already seeded."
          : `Seeded ${res.count} new starter draft${res.count === 1 ? "" : "s"}.`
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handleSeed}
        disabled={pending}
        className="text-sm px-4 py-2.5 rounded-lg bg-[#FD7215]/20 text-[#FD7215] hover:bg-[#FD7215]/30 disabled:opacity-50 transition-colors font-medium"
      >
        {pending ? "Seeding…" : "Seed starter challenges from census"}
      </button>
      {message && <span className="text-[#229434] text-sm">{message}</span>}
      {error && <span className="text-red-300 text-sm">{error}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* (c) Posts moderation table                                          */
/* ------------------------------------------------------------------ */

type FilterKey = "all" | "published" | "hidden" | "removed" | "draft";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "hidden", label: "Hidden" },
  { key: "removed", label: "Removed" },
  { key: "draft", label: "Drafts" },
];

const TYPE_LABEL: Record<string, string> = {
  challenge: "Challenge",
  best_practice: "Best practice",
  industry: "Industry",
};

function StatusBadge({ status }: { status: PostStatus }) {
  const cls =
    status === "published"
      ? "bg-[#229434]/20 text-[#229434]"
      : status === "hidden"
        ? "bg-amber-500/20 text-amber-400"
        : status === "removed"
          ? "bg-red-500/20 text-red-300"
          : "bg-white/10 text-white/40";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${cls}`}>
      {status}
    </span>
  );
}

export function ModerationTable({ posts }: { posts: CommunityPost[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: posts.length,
      published: 0,
      hidden: 0,
      removed: 0,
      draft: 0,
    };
    for (const p of posts) {
      if (p.status in c) c[p.status as FilterKey] += 1;
    }
    return c;
  }, [posts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (filter !== "all" && p.status !== filter) return false;
      if (!q) return true;
      const hay = [p.title, p.body, p.author_name, p.sector]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [posts, filter, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? "bg-[#FD7215]/20 text-[#FD7215] border-[#FD7215]/40"
                    : "bg-white/5 text-white/50 border-white/10 hover:border-white/20"
                }`}
              >
                {label} ({counts[key]})
              </button>
            );
          })}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, body, author…"
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#FD7215]/50"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
          <p className="text-white/40 text-sm">No posts in this view.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((post) => (
            <PostRow key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}

function PostRow({ post }: { post: CommunityPost }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [expanded, setExpanded] = useState(false);
  const [replies, setReplies] = useState<CommunityReply[] | null>(null);
  const [loadingReplies, setLoadingReplies] = useState(false);

  function act(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleToggleReplies() {
    const next = !expanded;
    setExpanded(next);
    if (next && replies === null) {
      setError(null);
      setLoadingReplies(true);
      startTransition(async () => {
        const res = await loadReplies(post.id);
        setLoadingReplies(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setReplies(res.replies);
      });
    }
  }

  function handleRemoveReply(replyId: string) {
    setError(null);
    startTransition(async () => {
      const res = await removeReply(replyId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setReplies((prev) => (prev ? prev.filter((r) => r.id !== replyId) : prev));
      router.refresh();
    });
  }

  function handleSuggest() {
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await suggestHelpers(post.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNote(
        res.count === 0
          ? "No matching helpers found for this post."
          : `Notified ${res.count} potential helper${res.count === 1 ? "" : "s"}.`
      );
      router.refresh();
    });
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">
              {TYPE_LABEL[post.post_type] ?? post.post_type}
            </span>
            <StatusBadge status={post.status} />
            {post.is_anonymous && (
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                Anon
              </span>
            )}
            {post.is_seeded && (
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/10 text-white/40">
                Seeded
              </span>
            )}
          </div>
          <Link
            href={`/yifi/community/${post.id}`}
            target="_blank"
            className="text-white font-medium hover:text-[#FD7215] transition-colors block truncate"
          >
            {post.title}
          </Link>
          <p className="text-white/50 text-sm line-clamp-2 whitespace-pre-wrap">
            {post.body}
          </p>
          <p className="text-white/40 text-xs">
            by {post.author_name || "Unknown"}
            {post.is_anonymous && post.author_name && " (shown anonymously)"}
            {post.sector ? ` · ${post.sector}` : ""}
            {` · ${post.reply_count} repl${post.reply_count === 1 ? "y" : "ies"}`}
            {` · ${post.upvote_count} upvote${post.upvote_count === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {error && <p className="text-red-300 text-xs">{error}</p>}
      {note && <p className="text-[#229434] text-xs">{note}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {post.status !== "hidden" && post.status !== "removed" && (
          <button
            type="button"
            onClick={() => act(() => setStatus(post.id, "hidden"))}
            disabled={pending}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/70 hover:border-amber-400/50 hover:text-amber-300 disabled:opacity-50 transition-colors"
          >
            Hide
          </button>
        )}
        {post.status !== "removed" && (
          <button
            type="button"
            onClick={() => act(() => setStatus(post.id, "removed"))}
            disabled={pending}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/70 hover:border-red-400/50 hover:text-red-300 disabled:opacity-50 transition-colors"
          >
            Remove
          </button>
        )}
        {(post.status === "hidden" || post.status === "removed") && (
          <button
            type="button"
            onClick={() => act(() => setStatus(post.id, "published"))}
            disabled={pending}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#229434]/20 text-[#229434] hover:bg-[#229434]/30 disabled:opacity-50 transition-colors"
          >
            Restore
          </button>
        )}
        <button
          type="button"
          onClick={handleSuggest}
          disabled={pending}
          className="text-xs px-3 py-1.5 rounded-lg border border-[#FD7215]/30 text-[#FD7215] hover:bg-[#FD7215]/10 disabled:opacity-50 transition-colors"
        >
          Suggest helpers
        </button>
        <button
          type="button"
          onClick={handleToggleReplies}
          disabled={pending && loadingReplies}
          className="text-xs px-3 py-1.5 rounded-lg text-white/50 hover:text-white transition-colors"
        >
          {expanded ? "Hide replies" : `Replies (${post.reply_count})`}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-white/10 pt-3 space-y-2">
          {loadingReplies ? (
            <p className="text-white/40 text-xs">Loading replies…</p>
          ) : replies && replies.length > 0 ? (
            replies.map((reply) => (
              <div
                key={reply.id}
                className="flex items-start justify-between gap-3 rounded-lg bg-black/20 border border-white/5 p-3"
              >
                <div className="min-w-0">
                  <p className="text-white/70 text-sm whitespace-pre-wrap">
                    {reply.body}
                  </p>
                  <p className="text-white/30 text-xs mt-1">
                    {reply.author_name || "Anonymous"}
                    {reply.is_best && (
                      <span className="ml-2 text-[#FD7215]">★ best answer</span>
                    )}
                    {` · ${reply.upvote_count} upvote${reply.upvote_count === 1 ? "" : "s"}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveReply(reply.id)}
                  disabled={pending}
                  className="shrink-0 text-xs px-2.5 py-1 rounded-lg border border-white/20 text-white/60 hover:border-red-400/50 hover:text-red-300 disabled:opacity-50 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <p className="text-white/40 text-xs">No replies on this post.</p>
          )}
        </div>
      )}
    </div>
  );
}
