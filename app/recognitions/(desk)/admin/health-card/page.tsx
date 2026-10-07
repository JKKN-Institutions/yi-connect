import Link from "next/link";
import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { rxService } from "@/lib/recognitions/supabase";
import { getCurrentCycle, getPeople, listAwards, listChapters, listHealthCardFiles } from "@/lib/recognitions/data";
import { Ribbon } from "../../../_ui/ribbon";
import { NoAccess, PageHead, formatWhen } from "../../../_ui/primitives";
import { HealthCardDesk } from "./health-card-desk";

export const metadata = { title: "Health Card" };

export default async function HealthCardPage({ searchParams }: { searchParams: Promise<{ award?: string }> }) {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const cycle = await getCurrentCycle();
  const awards = cycle ? await listAwards(cycle.id) : [];
  if (!cycle || awards.length === 0) {
    return (
      <div className="rx-stack-lg">
        <PageHead eyebrow="Control room" title="National Health Card" />
        <div className="rx-plate rx-stack">
          <p>{cycle ? "Add the awards first; each award has its own Health Card." : "Open a cycle first."}</p>
          <div>
            <Link className="rx-btn" href={cycle ? "/recognitions/admin/awards" : "/recognitions/admin/timeline"}>
              {cycle ? "Go to Awards" : "Go to Timeline"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { award: awardParam } = await searchParams;
  const award = awards.find((a) => a.id === awardParam) ?? awards[0];
  const [files, chapters, l1] = await Promise.all([
    listHealthCardFiles(award.id),
    listChapters(),
    rxService().from("recognition_layer1").select("chapter_id, score, source, updated_at").eq("award_id", award.id),
  ]);
  const uploaders = await getPeople(files.map((f) => f.uploaded_by ?? "").filter(Boolean));
  const scores = new Map(
    ((l1.data ?? []) as Array<{ chapter_id: string; score: number | string; source: string; updated_at: string }>).map((r) => [r.chapter_id, r])
  );

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={`Control room · ${cycle.name}`} title="National Health Card">
        <p className="rx-mute">
          Layer 1 ({cycle.weight_layer1}% of the total). Yi National keeps one Health Card per vertical. Upload it here; evaluators of this award can
          download the same file. Then pick the columns that hold the chapter name and the 0-100 score.
        </p>
      </PageHead>

      <nav className="rx-ad-chips" aria-label="Awards">
        {awards.map((a) => (
          <Link
            key={a.id}
            href={`/recognitions/admin/health-card?award=${a.id}`}
            className="rx-ad-chip"
            aria-current={a.id === award.id ? "page" : undefined}
          >
            <Ribbon vertical={a.vertical} /> {a.title}
          </Link>
        ))}
      </nav>

      <HealthCardDesk
        key={award.id}
        awardId={award.id}
        awardTitle={award.title}
        files={files.map((f) => ({
          id: f.id,
          name: f.file_name,
          when: formatWhen(f.uploaded_at),
          by: f.uploaded_by ? uploaders.get(f.uploaded_by)?.full_name ?? "Unknown" : "Unknown",
        }))}
        chapters={chapters.map((c) => {
          const s = scores.get(c.id);
          return {
            id: c.id,
            name: c.name,
            region: c.region,
            score: s ? Number(s.score) : null,
            source: (s?.source as "excel" | "manual" | undefined) ?? null,
            when: s ? formatWhen(s.updated_at) : null,
          };
        })}
      />
    </div>
  );
}
