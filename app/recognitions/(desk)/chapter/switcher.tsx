import Link from "next/link";
import type { ChapterRow } from "@/lib/recognitions/types";

/** Shown only when the viewer files for more than one chapter. Plain links: ?chapter=<id>. */
export function ChapterSwitcher({
  chapters,
  currentId,
  path,
}: {
  chapters: ChapterRow[];
  currentId: string;
  path: string;
}) {
  if (chapters.length < 2) return null;
  return (
    <nav aria-label="Choose a chapter" className="rx-row" style={{ gap: 8 }}>
      <span className="rx-eyebrow">Filing for</span>
      {chapters.map((c) => {
        const current = c.id === currentId;
        return (
          <Link
            key={c.id}
            href={`${path}?chapter=${encodeURIComponent(c.id)}`}
            className={current ? "rx-btn rx-btn-sm" : "rx-btn rx-btn-sm rx-btn-quiet"}
            aria-current={current ? "page" : undefined}
          >
            {c.name}
          </Link>
        );
      })}
    </nav>
  );
}
