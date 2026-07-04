"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PostType } from "@/lib/yifi/community/types";

/** Row shape returned by yifi_community_list_posts (a projection of a post). */
export interface BoardPost {
  id: string;
  title: string;
  post_type: PostType;
  sector: string | null;
  author_name: string | null;
  is_anonymous?: boolean;
  reply_count: number;
  upvote_count: number;
  has_best: boolean;
  created_at: string;
}

const TYPE_META: Record<PostType, { label: string; badge: string }> = {
  challenge: {
    label: "Challenge",
    badge: "bg-[#FD7215]/20 text-[#FD7215] border-[#FD7215]/30",
  },
  best_practice: {
    label: "Best Practice",
    badge: "bg-[#229434]/20 text-[#229434] border-[#229434]/30",
  },
  industry: {
    label: "Industry",
    badge: "bg-sky-400/20 text-sky-300 border-sky-400/30",
  },
};

const TYPE_FILTERS: { key: "all" | PostType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "challenge", label: "Challenges" },
  { key: "best_practice", label: "Best Practice" },
  { key: "industry", label: "Industry" },
];

export function BoardList({ posts }: { posts: BoardPost[] }) {
  const [type, setType] = useState<"all" | PostType>("all");
  const [sector, setSector] = useState<string | null>(null);

  const sectors = useMemo(() => {
    const set = new Set<string>();
    for (const p of posts) {
      if (p.sector) set.add(p.sector);
    }
    return Array.from(set).sort();
  }, [posts]);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (type !== "all" && p.post_type !== type) return false;
      if (sector && p.sector !== sector) return false;
      return true;
    });
  }, [posts, type, sector]);

  return (
    <div className="space-y-4">
      {/* Type pills */}
      <div className="flex flex-wrap gap-2">
        {TYPE_FILTERS.map((f) => {
          const active = type === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setType(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? "bg-[#FD7215] text-white border-[#FD7215]"
                  : "bg-white/5 text-white/60 border-white/15 hover:border-white/30"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Sector pills (optional) */}
      {sectors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSector(null)}
            className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
              sector === null
                ? "bg-white/15 text-white border-white/30"
                : "bg-transparent text-white/40 border-white/10 hover:border-white/25"
            }`}
          >
            All sectors
          </button>
          {sectors.map((s) => (
            <button
              key={s}
              onClick={() => setSector(sector === s ? null : s)}
              className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                sector === s
                  ? "bg-white/15 text-white border-white/30"
                  : "bg-transparent text-white/40 border-white/10 hover:border-white/25"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
          <p className="text-white/50 text-sm">
            {posts.length === 0
              ? "No posts yet. Be the first to start a conversation."
              : "No posts match this filter."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((post) => {
            const meta = TYPE_META[post.post_type];
            return (
              <li key={post.id}>
                <Link
                  href={`/yifi/community/${post.id}`}
                  className="block bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/25 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                        meta?.badge ?? "bg-white/10 text-white/50 border-white/20"
                      }`}
                    >
                      {meta?.label ?? post.post_type}
                    </span>
                    {post.sector && (
                      <span className="text-[10px] text-white/40 uppercase tracking-wide">
                        {post.sector}
                      </span>
                    )}
                    {post.has_best && (
                      <span className="ml-auto text-[#229434] text-xs font-medium">
                        Best answer ✓
                      </span>
                    )}
                  </div>

                  <p className="text-white font-medium text-sm leading-snug">
                    {post.title}
                  </p>

                  <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                    <span>{post.author_name ?? "Anonymous"}</span>
                    <span aria-hidden>·</span>
                    <span>
                      {post.reply_count} {post.reply_count === 1 ? "reply" : "replies"}
                    </span>
                    {post.upvote_count > 0 && (
                      <>
                        <span aria-hidden>·</span>
                        <span>▲ {post.upvote_count}</span>
                      </>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
