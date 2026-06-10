/**
 * NATIONAL — academies list (spec "National — academies").
 * National creates academies; creation IS the approval (no onboarding
 * pipeline / MoU). Defense-in-depth: gated here as well as by the national
 * layout (Phase 4) so the page fails closed even standalone.
 */

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import { requireYuvaNational } from "@/lib/yuva/auth/require-national";
import { AcademyLogo } from "@/components/yuva/academies/academy-card";
import { AcademyActiveToggle } from "@/components/yuva/academies/active-toggle";
import { fetchAcademies } from "@/components/yuva/academies/data";

export const metadata = { title: "Academies" };

export default async function NationalAcademiesPage() {
  const gate = await requireYuvaNational();
  if (!gate.ok) return <Forbidden403 reason={gate.error} />;

  const academies = await fetchAcademies({ kind: "all" });

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Academies</h1>
          <p className="text-sm text-slate-500">
            National-created academies across the Yi YUVA network — creating
            an academy is its approval.
          </p>
        </div>
        <Button asChild>
          <Link href="/youth-academy/national/academies/new">
            <Plus className="size-4" />
            New academy
          </Link>
        </Button>
      </div>

      {academies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-medium text-slate-700">
            Create your first academy
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Academies are created by the Yi national team — pick a chapter,
            optionally attach a partner institution, and the academy is live.
          </p>
          <Button asChild className="mt-4">
            <Link href="/youth-academy/national/academies/new">
              <Plus className="size-4" />
              New academy
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {academies.map((academy) => (
            <li
              key={academy.id}
              className="flex flex-wrap items-center gap-4 px-5 py-4"
            >
              <AcademyLogo
                url={academy.logo_url}
                name={academy.display_name}
                size={44}
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/youth-academy/national/academies/${academy.id}`}
                  className="font-medium text-slate-900 underline-offset-2 hover:underline"
                >
                  {academy.display_name}
                </Link>
                <p className="text-sm text-slate-500">
                  Yi {academy.chapter} ·{" "}
                  {academy.institution_name ?? "Not attached"} ·{" "}
                  {academy.runs_count}{" "}
                  {academy.runs_count === 1 ? "run" : "runs"}
                </p>
              </div>
              <AcademyActiveToggle
                academyId={academy.id}
                isActive={academy.is_active}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
