/**
 * CHAPTER surface gate (spec "Chapter — dashboard" / Phase 5 task 2).
 *
 * Allowed: a yuva chapter_admin with a real chapter scope, an
 * institution_coordinator bound to ≥1 active academy, or the national tier.
 * Everyone else gets an EXPLICIT Forbidden403 carrying the resolver's
 * verdict — NEVER a silent redirect (project rule: silent redirects create
 * undiagnosable bounce-loops).
 */

import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";

export const metadata = { title: "Chapter" };

export default async function ChapterLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const access = await getYuvaAccess();
  const allowed =
    access.isNational ||
    access.chapterAdminOf !== null ||
    access.coordinatorAcademyIds.length > 0;

  if (!allowed) {
    return <Forbidden403 reason={`This area is for Yi chapter admins, institution coordinators and the national team. Your access: ${access.reason}`} />;
  }

  return <>{children}</>;
}
