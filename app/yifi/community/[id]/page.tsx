import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import type { CommunityPost, CommunityReply } from "@/lib/yifi/community/types";
import { ReplyThread, FlagButton } from "./reply-thread";

export const metadata = {
  title: "Discussion",
};

interface Session {
  id: string;
  name: string;
  editionId: string;
}

interface PostDetail {
  post: CommunityPost | null;
  replies: CommunityReply[];
  is_viewer_author: boolean;
}

const TYPE_META: Record<string, { label: string; emoji: string; color: string }> = {
  challenge: { label: "Challenge", emoji: "🧩", color: "#FD7215" },
  best_practice: { label: "Best Practice", emoji: "💡", color: "#229434" },
  industry: { label: "Industry", emoji: "🏭", color: "#7aa2ff" },
};

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

async function getPost(
  postId: string,
  viewerId: string,
): Promise<PostDetail | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("yifi_community_get_post", {
    p_post_id: postId,
    p_viewer_registrant_id: viewerId,
  });
  if (error) return null;
  // RPC returns a single json object; tolerate an array wrapper defensively.
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) return null;
  return {
    post: (result.post as CommunityPost) ?? null,
    replies: Array.isArray(result.replies) ? (result.replies as CommunityReply[]) : [],
    is_viewer_author: Boolean(result.is_viewer_author),
  };
}

export default async function CommunityPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const raw = cookieStore.get("yifi_session")?.value;
  if (!raw) redirect("/yifi/join");

  let session: Session;
  try {
    session = JSON.parse(raw);
  } catch {
    redirect("/yifi/join");
  }
  if (!session.id) redirect("/yifi/join");

  const detail = await getPost(id, session.id);
  const post = detail?.post ?? null;
  const unavailable =
    !post || ["removed", "hidden", "draft"].includes(post.status);

  return (
    <main className="min-h-screen bg-[#000066]">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/30 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link
            href="/yifi/community"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
          >
            <span aria-hidden>←</span> Community
          </Link>
          <Link href="/yifi" className="text-lg font-bold text-[#FD7215]">
            YiFi
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        {unavailable ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="mb-1 text-lg font-medium text-white">
              This post isn&apos;t available
            </p>
            <p className="text-sm text-white/50">
              It may have been removed or is no longer published.
            </p>
            <Link
              href="/yifi/community"
              className="mt-4 inline-block text-sm font-medium text-[#FD7215] hover:underline"
            >
              ← Back to the community board
            </Link>
          </div>
        ) : (
          <>
            <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {(() => {
                  const meta =
                    TYPE_META[post!.post_type] ?? {
                      label: post!.post_type,
                      emoji: "💬",
                      color: "#FD7215",
                    };
                  return (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        color: meta.color,
                        backgroundColor: `${meta.color}22`,
                      }}
                    >
                      <span aria-hidden>{meta.emoji}</span> {meta.label}
                    </span>
                  );
                })()}
                {post!.sector && (
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/60">
                    {post!.sector}
                  </span>
                )}
                {post!.best_reply_id && (
                  <span className="rounded-full bg-[#229434]/20 px-2.5 py-0.5 text-xs font-medium text-[#229434]">
                    ✓ Answered
                  </span>
                )}
              </div>

              <h1 className="text-xl font-semibold leading-snug text-white">
                {post!.title}
              </h1>

              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/85">
                {post!.body}
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <span className="font-medium text-white/70">
                    {post!.author_name ?? "Anonymous"}
                  </span>
                  {post!.created_at && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{formatWhen(post!.created_at)}</span>
                    </>
                  )}
                  <span aria-hidden>·</span>
                  <span>
                    {post!.reply_count ?? 0}{" "}
                    {(post!.reply_count ?? 0) === 1 ? "reply" : "replies"}
                  </span>
                </div>
                <FlagButton postId={post!.id} />
              </div>
            </article>

            <ReplyThread
              postId={post!.id}
              viewerIsAuthor={detail!.is_viewer_author}
              replies={detail!.replies}
            />
          </>
        )}
      </div>
    </main>
  );
}
