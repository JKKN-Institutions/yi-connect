/**
 * YIQ — "How it works", one page, four audiences.
 *
 * DELIBERATELY UNGATED. A teacher deciding whether to enter their school has
 * no account and no access code, and must be able to read the whole thing
 * before they commit to anything. So this page reads no session, makes no
 * database call, and denies nobody.
 *
 * The lane comes from `?for=`, which makes every lane a shareable URL — an
 * organiser can hand a teacher /yiq/guide?for=teacher. An unknown or missing
 * value falls back to the student lane, the largest audience.
 *
 * Static: the content is a pure-data module (lib/yiq/guide/content.ts), so
 * this page prerenders and needs no revalidation.
 */
import type { Metadata } from "next";
import { GuideView } from "./guide-view";
import {
  YIQ_GUIDE,
  YIQ_GUIDE_AUDIENCES,
  isYiqGuideAudience,
  type YiqGuideAudience,
} from "@/lib/yiq/guide/content";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How YIQ works, for students, teachers, chapter organisers and YIQ national admins.",
};

/** Switch labels, resolved once from the book so they cannot drift from it. */
const LABELS = Object.fromEntries(
  YIQ_GUIDE_AUDIENCES.map((a) => [a, YIQ_GUIDE[a].label])
) as Record<YiqGuideAudience, string>;

export default async function YiqGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ for?: string }>;
}) {
  const { for: requested } = await searchParams;
  const audience: YiqGuideAudience = isYiqGuideAudience(requested)
    ? requested
    : "student";

  return (
    // Remount per lane so the sections' open/closed state re-seeds on the
    // first section of the new lane instead of carrying over the old one's.
    <GuideView key={audience} guide={YIQ_GUIDE[audience]} labels={LABELS} />
  );
}
