import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import {
  createChapterAnnouncement,
  deleteAnnouncement,
  editChapterAnnouncement,
  listChapterAnnouncements,
} from "@/app/yi-future/actions/announcements";
import type {
  ComposerState,
  AnnouncementResult,
} from "@/app/yi-future/actions/announcements-types";
import { AnnouncementComposer } from "@/components/yi-future/announcements/AnnouncementComposer";
import { EditAnnouncement } from "@/components/yi-future/announcements/EditAnnouncement";

const NAVY = "#1a1a3e";

type Team = { id: string; team_name: string };
type Delegate = { id: string; full_name: string };

async function getTeams(chapterId: string, editionId: string): Promise<Team[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select("id, team_name")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .order("team_name", { ascending: true });
  return (data as unknown as Team[]) ?? [];
}

async function getDelegates(
  chapterId: string,
  editionId: string
): Promise<Delegate[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("delegates")
    .select("id, full_name")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  return (data as unknown as Delegate[]) ?? [];
}

const AUDIENCE_LABEL: Record<string, string> = {
  everyone: "Everyone",
  chapter: "Whole chapter",
  team: "One team",
  delegate: "One delegate",
};

function timeAgo(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ChapterAnnouncementsPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const [teams, delegates, sent] = await Promise.all([
    getTeams(ctx.chapterId, ctx.editionId),
    getDelegates(ctx.chapterId, ctx.editionId),
    listChapterAnnouncements(ctx.chapterId, ctx.editionId),
  ]);

  const authorLabel = `${ctx.chapterName} Chapter Team`;

  async function postAction(
    _prev: ComposerState,
    formData: FormData
  ): Promise<ComposerState> {
    "use server";
    return createChapterAnnouncement(
      {
        chapterId: ctx!.chapterId,
        editionId: ctx!.editionId,
        authorLabel: `${ctx!.chapterName} Chapter Team`,
      },
      formData
    );
  }

  async function removeAnnouncement(formData: FormData) {
    "use server";
    await deleteAnnouncement(String(formData.get("id") ?? ""));
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: NAVY }}>
          Announcements
        </h2>
        <p className="mt-1 text-sm" style={{ color: `${NAVY}99` }}>
          Send updates to delegates in {ctx.chapterName}. They appear on each
          delegate&apos;s dashboard, signed &ldquo;{authorLabel}&rdquo;.
        </p>
      </div>

      <AnnouncementComposer
        mode="chapter"
        action={postAction}
        teams={teams.map((t) => ({ id: t.id, label: t.team_name }))}
        delegates={delegates.map((d) => ({ id: d.id, label: d.full_name }))}
      />

      {/* Sent history */}
      <section className="space-y-3">
        <h3
          className="text-sm font-bold uppercase tracking-widest"
          style={{ color: `${NAVY}99` }}
        >
          Sent ({sent.length})
        </h3>
        {sent.length === 0 ? (
          <div
            className="rounded-lg border bg-white p-6 text-center text-sm"
            style={{ borderColor: `${NAVY}1a`, color: `${NAVY}80` }}
          >
            Nothing sent yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {sent.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border bg-white p-4"
                style={{ borderColor: `${NAVY}1a` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold" style={{ color: NAVY }}>
                      {a.title}
                    </div>
                    <p
                      className="mt-0.5 text-sm whitespace-pre-wrap"
                      style={{ color: `${NAVY}b3` }}
                    >
                      {a.body}
                    </p>
                    <div
                      className="mt-2 flex flex-wrap items-center gap-2 text-[11px]"
                      style={{ color: `${NAVY}80` }}
                    >
                      <span
                        className="rounded-full px-2 py-0.5 font-semibold"
                        style={{ background: "#F5A62314", color: "#9a6a00" }}
                      >
                        {AUDIENCE_LABEL[a.audience] ?? a.audience}
                      </span>
                      <span>{timeAgo(a.created_at)}</span>
                      <span>· {a.read_count} read</span>
                    </div>
                  </div>
                  <form action={removeAnnouncement}>
                    <input type="hidden" name="id" value={a.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600/70 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
