import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import type { CommunityNotification } from "@/lib/yifi/community/types";
import { DraftApprove, type DraftPost } from "./draft-approve";
import { Notifications } from "./notifications";

export const metadata = {
  title: "Your community · YiFi",
};

async function getDrafts(registrantId: string, editionId: string): Promise<DraftPost[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase.rpc("yifi_community_list_my_drafts", {
    p_registrant_id: registrantId,
    p_edition_id: editionId,
  });
  return Array.isArray(data) ? (data as DraftPost[]) : [];
}

async function getNotifications(registrantId: string): Promise<CommunityNotification[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase.rpc("yifi_community_my_notifications", {
    p_registrant_id: registrantId,
  });
  return Array.isArray(data) ? (data as CommunityNotification[]) : [];
}

export default async function MyCommunityPage() {
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

  const [drafts, notifications] = await Promise.all([
    getDrafts(session.id, session.editionId),
    getNotifications(session.id),
  ]);

  return (
    <main className="min-h-screen bg-[#000066]">
      <header className="border-b border-white/10 bg-black/30 px-4 py-3 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/yifi/me" className="text-[#FD7215] font-bold text-lg">
            YiFi
          </Link>
          <Link
            href="/yifi/community"
            className="text-xs text-[#FD7215] border border-[#FD7215]/30 hover:border-[#FD7215]/60 px-2.5 py-1 rounded-md transition-colors"
          >
            Community board
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Your community</h1>
          <p className="text-white/50 text-sm mt-1">
            Approve your starter posts and keep up with replies.
          </p>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <span className="text-[#FD7215]">✨</span> Your starter challenges
          </h2>
          <p className="text-white/40 text-sm mb-4">
            We drafted these from your sign-up challenges — approve to share, or discard.
          </p>
          {drafts.length > 0 ? (
            <div className="space-y-3">
              {drafts.map((draft) => (
                <DraftApprove key={draft.id} draft={draft} />
              ))}
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
              <p className="text-white/50 text-sm">
                Nothing waiting. Anything you shared is now on the{" "}
                <Link href="/yifi/community" className="text-[#FD7215] hover:underline">
                  board
                </Link>
                .
              </p>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-[#FD7215]">🔔</span> Notifications
          </h2>
          <Notifications notifications={notifications} />
        </section>
      </div>
    </main>
  );
}
