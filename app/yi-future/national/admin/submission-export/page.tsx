import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { requireFutureNationalAdmin } from "@/lib/yi-future/auth/require-access";
import { formatBytes } from "@/lib/yi-future/submission-files";

export const dynamic = "force-dynamic";

type Row = {
  chapter_id: string;
  chapter: string;
  files: number;
  teams: number;
  bytes: number;
};

async function getRows(): Promise<{ rows: Row[]; submittedDeliverables: number }> {
  const svc = await createServiceClient();

  // future.submission_files is not in the generated types → loose client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: filesRaw } = await (svc as any)
    .schema("future")
    .from("submission_files")
    .select("size_bytes, submissions!inner(team_id, teams!inner(chapter_id))");

  const byChapter = new Map<string, { files: number; bytes: number; teams: Set<string> }>();
  for (const f of ((filesRaw as {
    size_bytes: number;
    submissions: { team_id: string; teams: { chapter_id: string | null } | null } | null;
  }[] | null) ?? [])) {
    const ch = f.submissions?.teams?.chapter_id;
    if (!ch) continue;
    if (!byChapter.has(ch)) byChapter.set(ch, { files: 0, bytes: 0, teams: new Set() });
    const agg = byChapter.get(ch)!;
    agg.files += 1;
    agg.bytes += f.size_bytes ?? 0;
    if (f.submissions?.team_id) agg.teams.add(f.submissions.team_id);
  }

  const { data: chaptersRaw } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  const rows: Row[] = [];
  for (const c of ((chaptersRaw as { id: string; name: string }[] | null) ?? [])) {
    const agg = byChapter.get(c.id);
    if (!agg) continue;
    rows.push({
      chapter_id: c.id,
      chapter: c.name,
      files: agg.files,
      teams: agg.teams.size,
      bytes: agg.bytes,
    });
  }
  rows.sort((a, b) => b.files - a.files);

  // Every submitted deliverable, uploaded or not. Shown next to the file count
  // so the size of the gap is visible up front, rather than discovered when the
  // white paper turns out thin.
  const { count: submittedDeliverables } = await svc
    .schema("future")
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted");

  return { rows, submittedDeliverables: submittedDeliverables ?? 0 };
}

export default async function SubmissionExportPage() {
  await requireFutureNationalAdmin();
  const { rows, submittedDeliverables } = await getRows();

  const totalFiles = rows.reduce((n, r) => n + r.files, 0);
  const totalBytes = rows.reduce((n, r) => n + r.bytes, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/yi-future/national/admin"
        className="text-sm text-navy/60 hover:text-navy inline-flex items-center min-h-[44px]"
      >
        ← National admin
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-navy tracking-tight">
        Download submitted files by chapter
      </h1>
      <p className="mt-2 text-sm text-navy/60 leading-relaxed">
        Every file a team uploaded, bundled per chapter, so a chapter&apos;s work
        can be read in one place — and fed to an AI to draft the white paper.
        Each download also contains a <strong>_manifest.txt</strong> listing
        every file with its team and phase.
      </p>

      {/* The honest limit, stated before anyone plans around this. */}
      <div className="mt-4 rounded-md border border-yi-gold/40 bg-yi-gold/5 px-3 py-2">
        <p className="text-xs text-navy/80 leading-relaxed">
          <strong>Only uploaded files can be collected.</strong> A team that
          submitted a Google Drive link instead of uploading keeps that document
          in their own Google account, and it cannot be gathered here. Of{" "}
          {submittedDeliverables} submitted deliverables so far, <strong>{totalFiles}</strong>{" "}
          {totalFiles === 1 ? "file has" : "files have"} been uploaded — the rest
          are links.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-navy/60">
          No files have been uploaded yet. Once teams start attaching files
          rather than pasting links, chapters will appear here.
        </p>
      ) : (
        <>
          <p className="mt-6 text-xs text-navy/50">
            {rows.length} {rows.length === 1 ? "chapter" : "chapters"} ·{" "}
            {totalFiles} files · {formatBytes(totalBytes)}
          </p>
          <div className="mt-2 divide-y divide-navy/10 border border-navy/10 rounded-lg overflow-hidden">
            {rows.map((r) => (
              <div
                key={r.chapter_id}
                className="flex items-center justify-between gap-3 px-4 py-3 bg-white"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-navy truncate">
                    {r.chapter}
                  </div>
                  <div className="text-xs text-navy/50">
                    {r.files} {r.files === 1 ? "file" : "files"} from {r.teams}{" "}
                    {r.teams === 1 ? "team" : "teams"} · {formatBytes(r.bytes)}
                  </div>
                </div>
                {/* A plain link, not fetch(): the browser handles the download
                    natively and a large bundle never sits in page memory. */}
                <a
                  href={`/yi-future/national/admin/submission-export/download?chapter=${r.chapter_id}`}
                  className="flex-shrink-0 px-3 py-2 min-h-[44px] inline-flex items-center rounded-md bg-navy text-white text-xs font-semibold"
                >
                  Download all
                </a>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
