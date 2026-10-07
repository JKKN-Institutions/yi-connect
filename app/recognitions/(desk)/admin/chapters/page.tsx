import Link from "next/link";
import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { getChapterCategories, getCurrentCycle, listChapters } from "@/lib/recognitions/data";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/recognitions/constants";
import { NoAccess, PageHead } from "../../../_ui/primitives";
import { CategoryTable, PasteCategories } from "./chapter-categories";

export const metadata = { title: "Chapter categories" };

export default async function ChaptersPage() {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const cycle = await getCurrentCycle();
  if (!cycle) {
    return (
      <div className="rx-stack-lg">
        <PageHead eyebrow="Control room" title="Chapter categories" />
        <div className="rx-plate rx-stack">
          <p>Open a cycle first; categories are set per cycle.</p>
          <div><Link className="rx-btn" href="/recognitions/admin/timeline">Go to Timeline</Link></div>
        </div>
      </div>
    );
  }
  const [chapters, cats] = await Promise.all([listChapters(), getChapterCategories(cycle.id)]);
  const counts = CATEGORIES.map((c) => ({ c, n: chapters.filter((ch) => cats.get(ch.id) === c).length }));
  const unset = chapters.filter((ch) => !cats.has(ch.id)).length;

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={`Control room · ${cycle.name}`} title="Chapter categories">
        <p className="rx-mute">
          Phase 0: every chapter competes in one category. A chapter without a category can&apos;t file a nomination. A nomination keeps the
          category it was submitted under, even if you change it later.
        </p>
      </PageHead>

      <div className="rx-plate rx-ad-counts">
        {counts.map(({ c, n }) => (
          <div key={c} className="rx-ad-count">
            <b>{n}</b>
            <span className="rx-small rx-mute">{CATEGORY_LABEL[c]}</span>
          </div>
        ))}
        <div className="rx-ad-count">
          <b style={{ color: unset ? "var(--rx-vermilion)" : undefined }}>{unset}</b>
          <span className="rx-small rx-mute">Not classified</span>
        </div>
      </div>

      <section className="rx-plate rx-stack">
        <h2 className="rx-h2">Paste a list</h2>
        <PasteCategories />
      </section>

      <CategoryTable
        rows={chapters.map((ch) => ({ id: ch.id, name: ch.name, region: ch.region, category: cats.get(ch.id) ?? null }))}
      />
    </div>
  );
}
