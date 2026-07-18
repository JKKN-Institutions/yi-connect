import { getAdminContext, hasPermission } from "../_guard";
import { AdminHeader, AccessDenied, StatTile } from "../_components";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import type { CommunityPost } from "@/lib/yifi/community/types";
import { ModerationTable, SeedStarterButton } from "./moderation-table";
import { FlagsPanel, type AdminFlag } from "./flags-panel";

export const metadata = {
  title: "Community · YiFi Admin",
};

/**
 * Normalize a raw admin_list_flags row into the typed AdminFlag shape the
 * FlagsPanel expects. The flag JSON schema is owned by Agent 1's RPC, so this
 * reads several candidate keys defensively for the flagger name and the
 * embedded flagged content.
 */
function normalizeFlag(raw: Record<string, unknown>): AdminFlag {
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;

  const postId = str(raw.post_id);
  const replyId = str(raw.reply_id);

  return {
    id: String(raw.id ?? ""),
    post_id: postId,
    reply_id: replyId,
    reason: str(raw.reason),
    status: str(raw.status) ?? "open",
    created_at: str(raw.created_at) ?? "",
    flagger_name:
      str(raw.flagger_name) ??
      str(raw.flagged_by_name) ??
      str(raw.flagger) ??
      null,
    content_title:
      str(raw.post_title) ?? str(raw.content_title) ?? str(raw.title),
    content_body:
      str(raw.reply_body) ??
      str(raw.post_body) ??
      str(raw.content_body) ??
      str(raw.body),
    content_kind: replyId ? "reply" : "post",
  };
}

export default async function CommunityAdminPage() {
  const ctx = await getAdminContext();
  if (!hasPermission(ctx.permissions, "community")) {
    return <AccessDenied permission="community" />;
  }

  const svc = await createServiceClient();
  const [postsRes, flagsRes] = await Promise.all([
    svc.rpc("yifi_community_admin_list_posts", {
      p_edition_id: ctx.editionId,
      p_status: null,
    }),
    svc.rpc("yifi_community_admin_list_flags", {
      p_edition_id: ctx.editionId,
      p_status: "open",
    }),
  ]);

  const posts: CommunityPost[] = Array.isArray(postsRes.data)
    ? (postsRes.data as CommunityPost[])
    : [];
  const flags: AdminFlag[] = Array.isArray(flagsRes.data)
    ? (flagsRes.data as Record<string, unknown>[]).map(normalizeFlag)
    : [];

  const published = posts.filter((p) => p.status === "published").length;
  const hidden = posts.filter(
    (p) => p.status === "hidden" || p.status === "removed"
  ).length;

  return (
    <main className="min-h-screen bg-[#000066]">
      <AdminHeader title="Community" />

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        <p className="text-white/50 text-sm max-w-3xl">
          The YIBE community board is where members post challenges, best
          practices and industry notes, and help each other. Seed starter
          challenges from the census, keep the queue clear of flagged content,
          and moderate posts and replies.
        </p>

        {/* Stat tiles */}
        <section>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatTile label="Total Posts" value={posts.length} />
            <StatTile label="Published" value={published} />
            <StatTile label="Hidden / Removed" value={hidden} />
            <StatTile label="Open Flags" value={flags.length} />
          </div>
        </section>

        {/* (a) Seed */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Starter content</h2>
          <p className="text-white/50 text-sm max-w-3xl">
            Create one draft challenge post per census challenge for every
            registrant who completed it. Drafts stay private until the member
            approves them — this only primes the board. Safe to re-run; already
            seeded challenges are skipped.
          </p>
          <SeedStarterButton />
        </section>

        {/* (b) Flags queue */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">
            Flag queue{" "}
            {flags.length > 0 && (
              <span className="text-red-300 text-sm">({flags.length} open)</span>
            )}
          </h2>
          <FlagsPanel flags={flags} />
        </section>

        {/* (c) Posts moderation */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">
            All posts ({posts.length})
          </h2>
          <ModerationTable posts={posts} />
        </section>
      </div>
    </main>
  );
}
