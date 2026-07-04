import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import { BoardList, type BoardPost } from "./board-list";

export const metadata = {
  title: "YiFi Community",
};

async function getPosts(editionId: string): Promise<BoardPost[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase.rpc("yifi_community_list_posts", {
    p_edition_id: editionId,
    p_type: null,
    p_sector: null,
  });
  return Array.isArray(data) ? (data as BoardPost[]) : [];
}

export default async function CommunityBoardPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("yifi_session")?.value;
  if (!raw) redirect("/yifi/join");

  let session: { id: string; name: string; editionId: string };
  try {
    session = JSON.parse(raw);
  } catch {
    redirect("/yifi/join");
  }
  if (!session.editionId) redirect("/yifi/join");

  const posts = await getPosts(session.editionId);

  return (
    <main className="min-h-screen bg-[#000066]">
      <header className="border-b border-white/10 bg-black/30 px-4 py-3 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/yifi/me" className="text-[#FD7215] font-bold text-lg">
            YiFi
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/yifi/me/community"
              className="text-xs text-white/60 hover:text-white transition-colors"
            >
              Your posts
            </Link>
            <span className="text-white/70 text-sm">{session.name}</span>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-[#FD7215]">💬</span> Community Board
            </h1>
            <p className="text-white/50 text-sm mt-1">
              Ask the room, share a win, or offer help to another founder.
            </p>
          </div>
          <Link
            href="/yifi/community/new"
            className="shrink-0 px-4 py-2 bg-[#FD7215] text-white text-sm font-semibold rounded-lg hover:bg-[#e5660f] transition-colors"
          >
            + New post
          </Link>
        </div>

        <BoardList posts={posts} />
      </div>
    </main>
  );
}
