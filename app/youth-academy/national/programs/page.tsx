import Link from "next/link";
import { Plus } from "lucide-react";
import { requireYuvaNational } from "@/lib/yuva/auth/require-national";
import { createServiceClient } from "@/lib/yuva/supabase/service";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import { CategoryBadge } from "@/components/yuva/national/category-badge";
import { ProgramStatusBadge } from "@/components/yuva/national/program-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Yi Youth Academy — national program-template list (Phase 4).
 * Columns: title, category badge, sessions count, total hours
 * (auto-computed from sessions), status, runs count.
 */

export const dynamic = "force-dynamic";

function formatMinutes(total: number): string {
  if (total <= 0) return "—";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export default async function NationalProgramsPage() {
  const gate = await requireYuvaNational();
  if (!gate.ok) {
    return <Forbidden403 reason={gate.error} />;
  }

  const svc = await createServiceClient();
  const [programsRes, sessionsRes, runsRes] = await Promise.all([
    svc
      .from("programs")
      .select("id, title, category, status, total_minutes, created_at")
      .order("created_at", { ascending: false }),
    svc.from("program_sessions").select("program_id"),
    svc.from("runs").select("program_id"),
  ]);

  const programs = programsRes.data ?? [];
  const sessionCounts = new Map<string, number>();
  for (const row of sessionsRes.data ?? []) {
    sessionCounts.set(
      row.program_id,
      (sessionCounts.get(row.program_id) ?? 0) + 1
    );
  }
  const runCounts = new Map<string, number>();
  for (const row of runsRes.data ?? []) {
    runCounts.set(row.program_id, (runCounts.get(row.program_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Program templates
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            National-authored templates chapters run as cohort programs.
            Approve a template to make it instantiable.
          </p>
        </div>
        <Link
          href="/youth-academy/national/programs/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          <Plus className="size-4" />
          New program
        </Link>
      </div>

      {programsRes.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Could not load programs: {programsRes.error.message}
        </div>
      ) : programs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            No program templates yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Create your first program template — title, category, objective
            and an ordered session structure.
          </p>
          <Link
            href="/youth-academy/national/programs/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            <Plus className="size-4" />
            New program
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Total hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Runs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map((program) => (
                <TableRow key={program.id}>
                  <TableCell>
                    <Link
                      href={`/youth-academy/national/programs/${program.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {program.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <CategoryBadge category={program.category} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {sessionCounts.get(program.id) ?? 0}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMinutes(program.total_minutes)}
                  </TableCell>
                  <TableCell>
                    <ProgramStatusBadge status={program.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {runCounts.get(program.id) ?? 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
