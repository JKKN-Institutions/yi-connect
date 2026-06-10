/**
 * NATIONAL — create academy (spec "National — academies": national creating
 * the academy IS the approval; chapter picked from the Yi chapter list with
 * a free-text fallback; optional institution; display-name default).
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import { requireYuvaNational } from "@/lib/yuva/auth/require-national";
import { listYiChapters } from "@/app/youth-academy/actions/academies";
import { AcademyForm } from "@/components/yuva/academies/academy-form";

export const metadata = { title: "New academy" };

export default async function NewAcademyPage() {
  const gate = await requireYuvaNational();
  if (!gate.ok) return <Forbidden403 reason={gate.error} />;

  const chaptersResult = await listYiChapters();
  const chapters = chaptersResult.success ? chaptersResult.data : [];

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Link
          href="/youth-academy/national/academies"
          className="inline-flex items-center gap-1 text-sm text-slate-500 underline-offset-2 hover:underline"
        >
          <ArrowLeft className="size-4" />
          Academies
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">New academy</h1>
        <p className="text-sm text-slate-500">
          Creating the academy is its approval — it goes live for the chapter
          immediately.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <AcademyForm chapters={chapters} />
      </div>
    </main>
  );
}
