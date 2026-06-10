import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireYuvaNational } from "@/lib/yuva/auth/require-national";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import { ProgramForm } from "@/components/yuva/national/program-form";

/**
 * Yi Youth Academy — new program template (Phase 4).
 * Creates the program row; the session structure builder lives on the
 * editor page the form redirects to after creation.
 */

export const dynamic = "force-dynamic";

export default async function NewProgramPage() {
  const gate = await requireYuvaNational();
  if (!gate.ok) {
    return <Forbidden403 reason={gate.error} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/youth-academy/national/programs"
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to programs
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          New program template
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Create the program first — you add the session structure (and
          per-session documents) on the next screen.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <ProgramForm />
      </div>
    </div>
  );
}
