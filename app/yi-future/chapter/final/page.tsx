import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";

type Event = {
  id: string;
  name: string;
  tagline: string | null;
  start_date: string | null;
  venue: string | null;
  is_published: boolean | null;
};

async function getEvents(
  chapterId: string,
  editionId: string
): Promise<Event[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("events")
    .select("id, name, tagline, start_date, venue, is_published")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .eq("type", "chapter_final")
    .order("start_date", { ascending: false });
  return (data as unknown as Event[]) ?? [];
}

export default async function ChapterFinalPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");
  const events = await getEvents(ctx.chapterId, ctx.editionId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Chapter Final</h2>
          <p className="mt-1 text-sm text-navy/60">
            Day-90 event: team presentations, jury Q&amp;A, shortlist
            announcement.
          </p>
        </div>
        <Link
          href="/yi-future/chapter/final/new"
          className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
        >
          + New event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-sm text-navy/50">
          No chapter final scheduled yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/yi-future/chapter/final/${e.id}`}
                className="block bg-white border border-navy/10 rounded-lg p-5 hover:border-yi-gold/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-navy">{e.name}</div>
                    {e.tagline && (
                      <div className="text-xs text-navy/60 mt-0.5">
                        {e.tagline}
                      </div>
                    )}
                    <div className="text-xs text-navy/50 mt-1">
                      {e.start_date ?? "—"}
                      {e.venue && <span> · {e.venue}</span>}
                    </div>
                  </div>
                  {e.is_published ? (
                    <span className="text-[10px] font-semibold text-yi-green bg-yi-green/10 px-1.5 py-0.5 rounded">
                      PUBLISHED
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-navy/40 bg-navy/5 px-1.5 py-0.5 rounded">
                      DRAFT
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
